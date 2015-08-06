/*global define,$ */
/*jslint browser:true,sloppy:true,nomen:true,unparam:true,plusplus:true */
/** @license
 | Copyright 2015 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
//============================================================================================================================//
define(['lib/i18n.min!nls/resources.js', 'appConfig', 'userConfig', 'dataAccess', 'diag'],
    function (i18n, appConfig, userConfig, dataAccess, diag) {
    var that, unsupported = false, needProxy = false, proxyReady;

    that = {
        numPhotos: 0,
        iVisiblePhoto: 0,
        photoSelected: false,
        iSelectedPhoto: -1,
        candidate: null,
        signedIn: false,
        completions: 0
    };

//============================================================================================================================//

    // Check for obsolete IE
    if ($("body").hasClass("unsupportedIE")) {
        unsupported = true;
    } else if ($("body").hasClass("IE9")) {
        needProxy = true;
    }

    // Bring the app to visibility
    $("#signinPage").fadeIn();

    // Enable the carousel swipe for mobile
    $('.carousel').bcSwipe({ threshold: 50 });

    // Get app, webmap, feature service
    var appConfigReadies = appConfig.init();

    // When we have the app parameters, we can continue setting up the app
    appConfigReadies.parametersReady.then(function () {
        if (appConfig.appParams.diag !== undefined) {diag.init()};  //???

        // Update the page's title
        document.title = appConfig.appParams.title;
        $("#page-title")[0].innerHTML = appConfig.appParams.title;

        // If a proxy is needed, launch the test for a usable proxy
        proxyReady = $.Deferred();
        if (needProxy) {
            $.getJSON(appConfig.appParams.proxyProgram + "?ping", function () {
                proxyReady.resolve();
            }).fail(function () {
                proxyReady.reject();
            });
        } else {
            appConfig.appParams.proxyProgram = null;
            proxyReady.resolve();
        }

        // Start up the social media connections
        var socialMediaReady = userConfig.init(appConfig.appParams, function (notificationType) {
            // Callback from current social medium
            switch (notificationType) {
                case userConfig.notificationSignIn:
                    diag.appendWithLF("sign-in callback; believed logged in: " + that.signedIn);  //???
                    if (!that.signedIn) {
                        that.signedIn = true;
                        diag.appendWithLF("    trigger signedIn:user");  //???
                        $(document).triggerHandler('signedIn:user');
                    }
                    break;
                case userConfig.notificationSignOut:
                    diag.appendWithLF("sign-out callback; believed logged in: " + that.signedIn);  //???
                    if (that.signedIn) {
                        that.signedIn = false;
                        $("#contentPage").fadeOut("fast");
                        $("#signinPage").fadeIn();
                        diag.appendWithLF("    switch content->signin");  //???
                        $(document).triggerHandler('hide:profile');
                        $("#profileAvatar").css("display", "none");
                    }
                    break;
                case userConfig.notificationAvatarUpdate:
                    var avatar = userConfig.getUser().avatar;
                    diag.appendWithLF("avatar callback; believed logged in: " + that.signedIn);  //???
                    if (avatar) {
                        $("#profileAvatar").css("backgroundImage", "url(" + avatar + ")");
                        $("#profileAvatar").fadeIn("fast");
                    } else {
                        $("#profileAvatar").css("display", "none");
                    }
                    break;
            }
        });

        // When the DOM is ready, we can start adjusting the UI
        $().ready(function () {

            // Populate the splash UI
            $("#signinTitle")[0].innerHTML = appConfig.appParams.title;
            $("#signinParagraph")[0].innerHTML = appConfig.appParams.splashText;

            // If we're not going to wait for the webmap's original image, just set the splash
            if (appConfig.appParams.useWebmapOrigImg) {
                appConfigReadies.webmapOrigImageUrlReady.then(function (url) {
                    if (url) {
                        appConfig.appParams.splashBackgroundUrl = url;
                    }
                    $("#signinPageBkgd").css("background-image", "url(" + appConfig.appParams.splashBackgroundUrl + ")").fadeIn(2000);
                });
            } else {
                $("#signinPageBkgd").css("background-image", "url(" + appConfig.appParams.splashBackgroundUrl + ")").fadeIn(2000);
            }

            // Show the splash UI
            $("#signinBlock").fadeIn();

            // If unsupported browser, tell the user and depart
            if (unsupported) {
                $("#signinLoginPrompt")[0].innerHTML = i18n.signin.unsupported;
                $("#signinLoginPrompt").fadeIn();
                return;
            }

            // If checking for proxy, add "checking" message
            if (needProxy) {
                $("#signinLoginPrompt")[0].innerHTML = i18n.signin.checkingServer;
                $("#signinLoginPrompt").fadeIn();
            }

            // Wait for the proxy check; already bypassed for browsers that don't need it
            proxyReady.done(function () {

                // When the feature service and survey are ready, we can set up the module that reads from and writes to the service
                appConfigReadies.surveyReady.done(function () {
                    dataAccess.init(appConfig.featureSvcParams.url, appConfig.featureSvcParams.id,
                        appConfig.featureSvcParams.objectIdField,
                        appConfig.appParams.surveyorNameField + "+is+null+or+"
                            + appConfig.appParams.surveyorNameField + "=''", appConfig.appParams.proxyProgram);

                    // Test if there are any surveys remaining to be done
                    dataAccess.getObjectCount().done(function (countRemaining) {
                        if (countRemaining > 0) {
                            // When the social media connections are ready, we can enable the social-media sign-in buttons
                            $("#signinLoginPrompt")[0].innerHTML = i18n.signin.signinFetching;
                            $("#signinLoginPrompt").fadeIn();
                            socialMediaReady.then(function () {
                                // Add the sign-in buttons
                                userConfig.initUI($("#socialMediaButtonArea")[0]);

                                // Switch to the sign-in prompt
                                $("#signinLoginPrompt").fadeOut("fast", function () {
                                    $("#signinLoginPrompt")[0].innerHTML = i18n.signin.signinLoginPrompt;
                                    $("#signinLoginPrompt").fadeIn("fast");
                                    $("#socialMediaButtonArea").fadeIn("fast");
                                });
                            }).fail(function () {
                                // Switch to the no-surveys message
                                $("#signinLoginPrompt").fadeOut("fast", function () {
                                    $("#signinLoginPrompt")[0].innerHTML = i18n.signin.noMoreSurveys;
                                    $("#signinLoginPrompt").fadeIn("fast");
                                });
                            });
                        } else {
                            $("#signinLoginPrompt")[0].innerHTML = i18n.signin.noMoreSurveys;
                            $("#signinLoginPrompt").fadeIn();
                        }
                    }).fail(function () {
                        $("#signinLoginPrompt")[0].innerHTML = i18n.signin.noMoreSurveys;
                        $("#signinLoginPrompt").fadeIn();
                    });
                }).fail(function () {
                    $("#signinLoginPrompt")[0].innerHTML = i18n.signin.noMoreSurveys;
                    $("#signinLoginPrompt").fadeIn();
                });

                // Don't need help button if there's no help to display
                if (appConfig.appParams.helpText.length === 0) {
                    $("#helpButton").css("display", "none");
                } else {
                    $("#helpButton")[0].title = i18n.tooltips.button_additionalInfo;
                    $("#helpTitle")[0].innerHTML = appConfig.appParams.title;
                    $("#helpBody")[0].innerHTML = appConfig.appParams.helpText;
                }

            }).fail(function () {
                // If proxy not available, tell the user
                $("#signinLoginPrompt").fadeOut("fast", function () {
                    $("#signinLoginPrompt")[0].innerHTML = i18n.signin.needProxy;
                    $("#signinLoginPrompt").fadeIn("fast");
                });
            });

            // i18n updates
            $("#previousImageBtn")[0].title = i18n.tooltips.button_previous_image;
            $("#nextImageBtn")[0].title = i18n.tooltips.button_next_image;

            $("#skipBtn")[0].innerHTML = i18n.tooltips.button_skip;
            $("#submitBtn")[0].innerHTML = i18n.tooltips.button_submit;

            $("#userProfileSelectionText")[0].innerHTML = i18n.labels.menuItem_profile;
            $("#userSignoutSelectionText")[0].innerHTML = i18n.labels.menuItem_signout;

            $("#modalCloseBtn1")[0].title = i18n.tooltips.button_close;
            $("#modalCloseBtn2")[0].title = i18n.tooltips.button_close;
            $("#modalCloseBtn2")[0].innerHTML = i18n.labels.button_close;

            $("#surveysCompleted")[0].innerHTML = i18n.labels.label_surveys_completed;
            $("#closeProfileBtn")[0].innerHTML = i18n.labels.button_returnToSurvey;

        });
    });



    // Using colons for custom event names as recommended by https://learn.jquery.com/events/introduction-to-custom-events/#naming-custom-events
    $(document).on('signedIn:user', function (e) {
        appConfigReadies.surveyReady.then(function () {
            var user = userConfig.getUser();

            // Heading on survey/profile page
            $("#name")[0].innerHTML = user.name;
            $("#name2")[0].innerHTML = user.name;

            dataAccess.getObjectCount(appConfig.appParams.surveyorNameField + "='" + user.name + "'").then(function (count) {
                if (count >= 0) {
                    that.completions = count;
                    updateCount();
                } else {
                    $("#profileCount").css("display", "none");
                    $("#ranking").css("display", "none");
                }

            }).fail(function (error) {
                $("#profileCount").css("display", "none");
                $("#ranking").css("display", "none");
            });

            $("#hearts").css("display", "none");

            $("#signinPage").fadeOut( );
        });
        appConfigReadies.surveyReady.then(function () {
            $(document).triggerHandler('show:newSurvey');
        });
    });

    $(document).on('signedOut:user', function (e) {
        userConfig.signOut();
    });

    $(document).on('show:newSurvey', function (e) {
        $("#submitBtn")[0].blur();

        // Get candidate property
        dataAccess.getCandidate(appConfig.appParams.randomizeSelection).then(function (candidate) {
            // obj:feature{}
            // attachments:[{id,url},...]

            that.numPhotos = candidate.attachments.length;
            if (!candidate.obj) {
                $(document).triggerHandler('show:newSurvey');
                return;
            } else if (that.numPhotos === 0) {
                diag.appendWithLF("no photos for property <i>" + JSON.stringify(candidate.obj.attributes) + "</i>");  //???
                candidate.obj.attributes[appConfig.appParams.surveyorNameField] = "no photos";
                dataAccess.updateCandidate(candidate);
                $(document).triggerHandler('show:newSurvey');
                return;
            }
            diag.appendWithLF("showing property <i>" + JSON.stringify(candidate.obj.attributes) + "</i> with "  //???
                + that.numPhotos + " photos");  //???


            that.candidate = candidate;
            that.iSelectedPhoto = -1;


            // Gallery
            var carouselSlidesHolder = $("#carouselSlidesHolder")[0];
            $(carouselSlidesHolder).children().remove();  // remove children and their events
            var carouselIndicatorsHolder = $("#carouselIndicatorsHolder")[0];
            $(carouselIndicatorsHolder).children().remove();  // remove children and their events
            var initiallyActiveItem =
                Math.floor((that.numPhotos + 1) / 2) - 1;  // len=1,2: idx=0; len=3,4; idx=1; etc. (idx 0-based)

            $.each(candidate.attachments, function (indexInArray, attachment) {
                addPhoto(carouselSlidesHolder, indexInArray, (initiallyActiveItem === indexInArray), attachment.url);
                addPhotoIndicator(carouselIndicatorsHolder, indexInArray, (initiallyActiveItem === indexInArray),
                "carousel", attachment.url);
            });
            $("#carousel").trigger('create');

            updatePhotoSelectionDisplay();
        }).fail(function (error) {
        });

        // Survey
        var surveyContainer = $("#surveyContainer")[0];
        $(surveyContainer).children().remove();  // remove children and their events
        $.each(appConfig.survey, function (indexInArray, questionInfo) {
            addQuestion(surveyContainer, indexInArray, questionInfo);
        });
        $(".btn-group").trigger('create');

        // Can submit?
        $("#submitBtn").attr("disabled", !userConfig.getUser().canSubmit);

        // Show the content
        $("#contentPage").fadeIn("fast");
    });

    $(document).on('show:profile', function (e) {
        $("#survey").fadeOut("fast", function () {
            $("#profile").fadeIn("fast");
        });
    });
    $(document).on('hide:profile', function (e) {
        $("#profile").fadeOut("fast", function () {
            $("#survey").fadeIn("fast");
        });
    });



    // Wire up app
    $("#userSignoutSelection").on('click', function () {
        $(document).triggerHandler('signedOut:user');
    });
    $("#userProfileSelection").on('click', function () {
        $(document).triggerHandler('show:profile');
    });
    $("#closeProfileBtn").on('click', function () {
        $(document).triggerHandler('hide:profile');
    });
    $("#skipBtn").on('click', function () {
        $(document).triggerHandler('show:newSurvey');
    });
    $("#submitBtn").on('click', function () {
        var surveyContainer, msg, iQuestionResult, hasImportants = true, firstMissing;

        surveyContainer = $('#surveyContainer');
        $.each(appConfig.survey, function (iQuestion, questionInfo) {
            if (questionInfo.style === "button") {
                iQuestionResult = $('#q' + iQuestion + ' .active', surveyContainer).val();
            } else {
                iQuestionResult = $('input[name=q' + iQuestion + ']:checked', surveyContainer).val();
            }
            if (iQuestionResult) {
                that.candidate.obj.attributes[questionInfo.field] = questionInfo.domain.split("|")[iQuestionResult];
            }

            // Flag missing importants
            if (questionInfo.important) {
                if (iQuestionResult) {
                    $("#qg" + iQuestion).removeClass("flag-error");
                } else {
                    $("#qg" + iQuestion).addClass("flag-error");
                    hasImportants = false;
                    if (firstMissing === undefined) {
                        firstMissing = $("#qg" + iQuestion)[0];
                    }
                }
            }
        });

        // Submit the survey if it has the important responses
        if (hasImportants) {
            that.candidate.obj.attributes[appConfig.appParams.surveyorNameField] = userConfig.getUser().name;
            if (that.iSelectedPhoto >= 0) {
                that.candidate.obj.attributes[appConfig.appParams.bestPhotoField] = that.candidate.attachments[that.iSelectedPhoto].id;
            }
            diag.appendWithLF("saving survey for property <i>" + JSON.stringify(that.candidate.obj.attributes) + "</i>");  //???
            dataAccess.updateCandidate(that.candidate);

            that.completions += 1;
            updateCount();

            $(document).triggerHandler('show:newSurvey');

        // Jump to the first missing important question otherwise
        // From http://stackoverflow.com/a/6677069
        } else {
            $("#sidebarContent").animate({
                scrollTop: firstMissing.offsetTop - 5
            }, 500);
        }
    });

    $("#hearts").on('click', function () {
        that.photoSelected = !that.photoSelected;
        that.iVisiblePhoto = parseInt($("#carouselSlidesHolder > .item.active")[0].id.substring(1));
        that.iSelectedPhoto = that.photoSelected ? that.iVisiblePhoto : -1;
        /*showHeart('filledHeart', that.photoSelected);
        that.iSelectedPhoto = that.photoSelected ? that.iVisiblePhoto : -1;*/
        updatePhotoSelectionDisplay();
    });

    function showHeart(heartId, makeVisible) {
        document.getElementById(heartId).style.display = makeVisible ? 'block' : 'none';
    }

    // Manage group of buttons in a radio style
    $(".btn-group > .btn").click(function(){
        $(this).addClass("active").siblings().removeClass("active");
    });

    $("#carousel").on('slide.bs.carousel', function (data) {
        // Check if we should slide: swipe jumps right into here
        if ((that.iVisiblePhoto === 0 && data.direction === "right")
            || (that.iVisiblePhoto === (that.numPhotos - 1) && data.direction === "left")) {
            // Block move
diag.appendWithLF("block slide to " + data.direction);  //???
            data.preventDefault();
        } else {
            // Otherwise, hide the heart until the next slide appears
            $("#hearts")[0].style.display = "none";
        }
    });

    $("#carousel").on('slid.bs.carousel', function (data) {
        updatePhotoSelectionDisplay();
    });

    function updatePhotoSelectionDisplay() {
        // After carousel slide
        that.iVisiblePhoto = parseInt($("#carouselSlidesHolder > .item.active")[0].id.substring(1));

        // Update left & right sliders for where we are in the carousel to block wrapping of carousel movement
        $("#leftCarouselCtl").css("display", (that.iVisiblePhoto === 0 ? "none" : "block"));
        $("#rightCarouselCtl").css("display", (that.iVisiblePhoto === (that.numPhotos - 1) ? "none" : "block"));

        // Update selected photo indicator
        that.photoSelected = that.iVisiblePhoto === that.iSelectedPhoto;
        showHeart('emptyHeart', !that.photoSelected);
        showHeart('filledHeart', that.photoSelected);
        $("#hearts").attr("title",
            (that.photoSelected ? i18n.tooltips.button_best_image : i18n.tooltips.button_click_if_best_image));
        $("#hearts")[0].style.display = "block";
    }

    function updateCount() {
        $("#score")[0].innerHTML = that.completions;
        $("#score2")[0].innerHTML = that.completions;
        $("#profileCount").fadeIn();

        if (appConfig.appParams.contribLevels.length > 0) {
            // Find the user's level
            var level = appConfig.appParams.contribLevels.length - 1;
            var surveysForNextLevel = -1;
            while (appConfig.appParams.contribLevels[level].minimumSurveysNeeded > that.completions) {
                surveysForNextLevel = appConfig.appParams.contribLevels[level].minimumSurveysNeeded;
                level -= 1;
            }

            // Show ranking via text and stars
            $("#rankLabel")[0].innerHTML = appConfig.appParams.contribLevels[level].label;
            $("#level")[0].innerHTML = i18n.labels.label_level.replace("${0}", level);
            if (level === 0) {
                $("img", ".profileRankStars").attr("src", "images/empty-star.png");
            } else {
                var stars = $("img:eq(" + (level - 1) + ")", ".profileRankStars");
                stars.prevAll().andSelf().attr("src", "images/filled-star.png");
                stars.nextAll().attr("src", "images/empty-star.png");
            }

            // If below top level, show how far to next level
            var doneThisLevel = that.completions - appConfig.appParams.contribLevels[level].minimumSurveysNeeded;
            var remainingToNextLevel = Math.max(0, surveysForNextLevel - that.completions);
            var surveysThisLevel = doneThisLevel + remainingToNextLevel;
            if (surveysForNextLevel >= 0 && surveysThisLevel > 0) {
                var cRankBarWidthPx = 170;
                $("#profileRankBarFill")[0].style.width = (cRankBarWidthPx * doneThisLevel / surveysThisLevel) + "px";
                $("#profileRankBar").css("display", "block");

                $("#remainingToNextLevel")[0].innerHTML =
                    i18n.labels.label_remaining_surveys.replace("${0}", remainingToNextLevel);
            } else {
                $("#remainingToNextLevel")[0].innerHTML = "";
                $("#profileRankBar").css("display", "none");
            }

            $("#ranking").fadeIn();
        } else {
            $("#ranking").css("display", "none");
        }
    }






    function startQuestion(surveyContainer, iQuestion, questionInfo) {
        // <div class='form-group'>
        //   <label for='q1'>Is there a structure on the property? <span class='glyphicon glyphicon-star'></span></label><br>
        //??? TODO: i18n "Please answer this question"
        var start =
            "<div id='qg" + iQuestion + "' class='form-group'>"
            + "<label for='q" + iQuestion + "'>" + questionInfo.question
            + (questionInfo.important ? "&nbsp;<span class='glyphicon glyphicon-star' title=\""
            + i18n.tooltips.flag_important_question + "\"></span>" : "")
            + "</label><br>";
        return start;
    }

    function createButtonChoice(surveyContainer, iQuestion, questionInfo) {
        // <div id='q1' class='btn-group'>
        //   <button type='button' class='btn'>Yes</button>
        //   <button type='button' class='btn'>No</button>
        //   <button type='button' class='btn'>Not sure</button>
        // </div>
        var buttons = "<div id='q" + iQuestion + "' class='btn-group'>";
        var domain = questionInfo.domain.split('|');
        $.each(domain, function (i, choice) {
            buttons += "<button type='button' class='btn' value='" + i + "'>" + choice + "</button>";
        });
        buttons += "</div>";
        return buttons;
    }

    function createListChoice(surveyContainer, iQuestion, questionInfo) {
        // <div class='radio'><label><input type='radio' name='q1' id='optionFound1' value='0'>Crawlspace</label></div>
        // <div class='radio'><label><input type='radio' name='q1' id='optionFound2' value='1'>Raised</label></div>
        // <div class='radio'><label><input type='radio' name='q1' id='optionFound3' value='2'>Elevated</label></div>
        // <div class='radio'><label><input type='radio' name='q1' id='optionFound4' value='3'>Slab on grade</label></div>
        // <div class='radio'><label><input type='radio' name='q1' id='optionFound0' value='4'>Not sure</label></div>
        var list = "";
        var domain = questionInfo.domain.split('|');
        $.each(domain, function (i, choice) {
            list += "<div class='radio'><label><input type='radio' name='q" + iQuestion + "' value='" + i + "'>" + choice + "</label></div>";
        });
        return list;
    }

    function wrapupQuestion(surveyContainer, iQuestion, questionInfo) {
        // </div>
        // <div class='clearfix'></div>
        var wrap = "</div><div class='clearfix'></div>";
        return wrap;
    }

    function addQuestion(surveyContainer, iQuestion, questionInfo) {
        var question = startQuestion(surveyContainer, iQuestion, questionInfo);
        if (questionInfo.style === "button") {
            question += createButtonChoice(surveyContainer, iQuestion, questionInfo);
        } else {
            question += createListChoice(surveyContainer, iQuestion, questionInfo);
        }
        question += wrapupQuestion(surveyContainer, iQuestion, questionInfo);
        $(surveyContainer).append(question);

        // Fix radio-button toggling
        if (questionInfo.style === "button") {
            $('#q' + iQuestion + ' button').click(function() {
                $(this).addClass('active').siblings().removeClass('active');
            });
        }
    }

    function addPhoto(carouselSlidesHolder, indexInArray, isActive, photoUrl) {
        // <div id='carousel0' class='item active'><img src='__test/VIRB0125.JPG' alt='VIRB0125.JPG'></div>
        // var content = "<div id='c" + indexInArray + "' class='item" + (isActive ? " active" : "") +
        //    "'><img src='" + photoUrl + "'></div>";
        // $(carouselSlidesHolder).append(content);

        // var content = $("<div id='c" + indexInArray + "' class='item" + (isActive ? " active" : "") + "'></div>");
        var content = "<div id='c" + indexInArray + "' class='item" + (isActive ? " active" : "") + "'><img /></div>";
        $(carouselSlidesHolder).append(content);

        if (indexInArray === -1) {  //???
            loadImage(photoUrl, $("#c" + indexInArray + " img")[0]);  //???
        } else {
            var img = $("#c" + indexInArray + " img")[0];
            img.src = photoUrl;
            $(img).on('error', function (err) {
                img.src = "images/noPhoto.png";
                $(img).css("margin", "auto");
            });
        }

        /*loadImage(photoUrl).then(function (imgElement) {
            $(content).append(imgElement);
            $(carouselSlidesHolder).append(content);
        });*/
    }

    function addPhotoIndicator(carouselIndicatorsHolder, indexInArray, isActive, carouselId, photoUrl) {
        // <li data-target='#myCarousel' data-slide-to='0' class='active'></li>
        var content = "<li id='indicator-" + indexInArray + "' data-target='#" + carouselId + "' data-slide-to='" + indexInArray +
            "'" + (isActive ? " class='active'" : "") + "></li>";
        $(carouselIndicatorsHolder).append(content);
        $("#indicator-" + indexInArray).css("background-image", "url(" + photoUrl + ")");
    }

    //------------------------------------------------------------------------------------------------------------------------//


    function testURL(url, callback) {
        $.ajax( {
            type: 'HEAD',
            url: url,
            success: function() {
                callback(true);
            },
            error: function() {
                callback(false);
            }
        });
    }

    function startPhotoSet(numPhotos) {
        // Init shared progress bar
    }

    // https://gist.github.com/jafstar/3395525
    // with mods to anonymous functions
    var progressBar;

    function loadImage(imageURI, context)
    {
        var request;
        //var deferred = $.Deferred();
        //var imageElement = document.createElement("img");

        request = new XMLHttpRequest();
        request.onloadstart = function () {
            progressBar = document.createElement("progress");
            progressBar.value = 0;
            progressBar.max = 100;
            progressBar.removeAttribute("value");
            document.body.appendChild(progressBar);
        };
        request.onprogress = function (e) {
            if (e.lengthComputable)
                progressBar.value = e.loaded / e.total * 100;
            else
                progressBar.removeAttribute("value");
        };
        request.onload = function () {
            //imageElement.src = "data:image/jpeg;base64," + base64Encode(request.responseText);
            //deferred.resolve(imageElement);

            context.src = "data:image/jpeg;base64," + base64Encode(request.responseText);
        };
        request.onloadend = function () {
            document.body.removeChild(progressBar);
        };
        request.open("GET", imageURI, true);
        request.overrideMimeType('text/plain; charset=x-user-defined');
        request.send(null);

        //return deferred;
    }

    // This encoding function is from Philippe Tenenhaus's example at http://www.philten.com/us-xmlhttprequest-image/
    function base64Encode(inputStr)
    {
       var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
       var outputStr = "";
       var i = 0;

       while (i < inputStr.length)
       {
           //all three "& 0xff" added below are there to fix a known bug
           //with bytes returned by xhr.responseText
           var byte1 = inputStr.charCodeAt(i++) & 0xff;
           var byte2 = inputStr.charCodeAt(i++) & 0xff;
           var byte3 = inputStr.charCodeAt(i++) & 0xff;

           var enc1 = byte1 >> 2;
           var enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);

           var enc3, enc4;
           if (isNaN(byte2))
           {
               enc3 = enc4 = 64;
           }
           else
           {
               enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
               if (isNaN(byte3))
               {
                   enc4 = 64;
               }
               else
               {
                   enc4 = byte3 & 63;
               }
           }

           outputStr += b64.charAt(enc1) + b64.charAt(enc2) + b64.charAt(enc3) + b64.charAt(enc4);
        }

        return outputStr;
    }


});
