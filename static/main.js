$(document).ready(function () {
    let currentArticle = null; // This will store the currently active article
    for (let i = 0; i < 42; i++) {
        $('#loading').append('<div class="loading-circle"></div>');
    }
    tinymce.init({
        selector: "#translation-editor",
        height: '100vh',
        plugins: 'anchor autolink code charmap codesample image link lists media searchreplace table wordcount',
        toolbar: 'undo redo | fontfamily fontsize | bold italic underline strikethrough | link image media table | align lineheight | numlist bullist indent outdent | charmap | removeformat | code | wordcount',
        content_style: 'img { max-width: 100% !important; } .mce-content-body { padding-bottom: 6rem !important; }',
        statusbar: false,
        init_instance_callback: function (editor) {
            syncTinyMCEScroll(editor);
        },
    });

    function loadArticles() {
        // Start Loading UI
        $("#loading").show().find("#loading-text").text("Loading...");

        // Use the appropriate route based on the environment
        var articlesRoute = location.hostname === "localhost" || location.hostname === "127.0.0.1"
            ? "/api/get_dummy_data"
            : "/api/get_all_articles";

        $.getJSON("/api/get_article_count").done(function(countData) {
            const totalArticles = countData.count;
            // Update Loading UI
            $("#loading-text").text("Loading " + totalArticles + " articles...");

            // Fetch the actual articles after we have the count
            $.getJSON(articlesRoute).done(function(articleData) {
                // Update the UI with the articles
                renderArticles(articleData);
            }).always(function() {
                // End Loading UI
                $("#loading").remove();
            });
        });
    }

    function renderArticles(data) {

        if (!Array.isArray(data)) {
            data = [data];
        }

        // Sort articles by publication date (latest first)
        data.sort(function (a, b) {
            return new Date(b.pubDate) - new Date(a.pubDate);
        });

        // Create an object to hold the articles by source
        const articlesBySource = {};

        data.forEach(function (article) {
            if (!articlesBySource[article.source]) {
                articlesBySource[article.source] = [];
            }
            articlesBySource[article.source].push(article);
        });

        // Add a "Latest" accordion with articles from the past 12 hours
        articlesBySource["Latest"] = filterLatestArticles(data);

        // Clear the existing accordions
        $("#source-accordion").empty();

        // Iterate over each source and create the accordion items
        Object.keys(articlesBySource)
            .sort((a, b) => (a === "Latest" ? -1 : a.localeCompare(b)))
            .forEach(function (source) {
                const sourceArticles = articlesBySource[source];
                // Create the accordion item for this source
                const accordionItem = $("<div>")
                    .addClass("accordion-item")
                    .appendTo("#source-accordion");

                // Create the accordion header
                const accordionHeader = $("<h2>")
                    .addClass("accordion-header")
                    .attr("id", `${source}-heading`)
                    .appendTo(accordionItem);

                // Create the accordion button
                $("<button>")
                    .addClass("accordion-button collapsed")
                    .attr("type", "button")
                    .attr("data-bs-toggle", "collapse")
                    .attr("data-bs-target", `#${source}-collapse`)
                    .attr("aria-expanded", "false")
                    .attr("aria-controls", `${source}-collapse`)
                    .text(source)
                    .appendTo(accordionHeader);

                // Create the accordion collapse
                const accordionCollapse = $("<div>")
                    .attr("id", `${source}-collapse`)
                    .addClass("accordion-collapse collapse")
                    .attr("aria-labelledby", `${source}-heading`)
                    .attr("data-bs-parent", "#source-accordion")
                    .appendTo(accordionItem);

                // Create the list group for this source's articles
                const listGroup = $("<ul>")
                    .addClass("list-group")
                    .appendTo(accordionCollapse);

                // Add the articles to the list group
                sourceArticles.forEach(function (article) {
                    const listItem = $("<li>")
                        .addClass("list-group-item")
                        .data("article", article)
                        .on("click", function (event) {
                            onArticleClick(event);
                            currentArticle = article;

                            $("#original-title").html(article.title);
                            $("#original-html").html(article.html);
                            $("#original-link").attr("href", article.link);

                            let titles = article.title_translated.split('タイトル').filter(t => t.trim() !== '');
                            let formattedTitleTranslated = titles.map(t => `<p style="font-weight: 700;margin: 0;">タイトル${t.trim()}</p>`).join('');

                            tinymce.get("translation-editor").setContent(`<h3>${formattedTitleTranslated}</h3>${article.content_translated || ''}`);
                        });

                    // Add the title
                    $("<span>")
                        .text(article.title)
                        .appendTo(listItem);

                    // Add the source icon
                    getSourceIcon(article.source).appendTo(listItem);

                    // Add the formatted date
                    $("<small>")
                        .addClass("text-muted")
                        .text(formatDateToJST(article.pubDate))
                        .appendTo(listItem);

                    listItem.appendTo(listGroup);
                });
            });
        adjustAccordionHeight();
    }

    loadArticles();

    function filterLatestArticles(articles) {
        const now = new Date();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        return articles.filter(article => {
            const pubDate = new Date(article.pubDate);
            return now - pubDate < twentyFourHours;
        });
    }

    function formatDateToJST(dateString) {
        const localDate = new Date(dateString);
        const offset = 9 * 60; // Tokyo is UTC+9
        const jstDate = new Date(localDate.getTime() + (offset + localDate.getTimezoneOffset()) * 60000);

        // specify date and time formatting options
        const dateOptions = { month: '2-digit', day: '2-digit' };
        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };

        // get date and time parts
        let datePart = jstDate.toLocaleDateString('en-US', dateOptions);
        let timePart = jstDate.toLocaleTimeString('en-US', timeOptions);

        // remove leading zeros in date part
        datePart = datePart.replace(/(^|\D)0+/g, "$1");

        // remove leading zero in the hour part of time and convert to upper case
        let [hourPart, minutePart] = timePart.split(":");
        hourPart = hourPart.replace(/(^|\D)0+/g, "$1");
        timePart = hourPart + ":" + minutePart;

        // join date and time parts
        return datePart + ', ' + timePart;
    }

    function getSourceIcon(source) {
        const sourceMap = {
            "Cointelegraph": { text: "CT", color: "#fabf2c" },
            "Blockworks": { text: "BW", color: "#ff5249", font: "#fff" },
            "Ambcrypto": { text: "AM", color: "#a0ffff" },
            "TheBlock": { text: "TB", color: "#9C27B0", font: "#fff" },
            "Wublock": { text: "WU", color: "#1d9bf0" },
            "CoinDesk": { text: "CD", color: "#00d4a1" },
            "CryptoNews": { text: "CN", color: "#9baaff" },
            "ODaily": { text: "OD", color: "#222", font: "#fff" },
            "NFTNow": { text: "NN", color: "#222", font: "#ff00c1" },
        };

        const iconData = sourceMap[source] || { text: "N/A", color: "gray" };

        const icon = $('<span>')
            .css({
                display: 'inline-block',
                backgroundColor: iconData.color,
                color: iconData.font,
                borderRadius: '4px',
                padding: '2px 4px',
                marginLeft: '4px',
                fontSize: '10px',
                position: 'absolute',
                right: '0',
                bottom: '0',
                fontWeight: '700',
            })
            .text(iconData.text);

        return icon;
    }

    function adjustAccordionHeight() {
        var totalHeaderHeight = $('.accordion-header').length * 28;
        var maxContentHeight = 'calc(100vh - ' + totalHeaderHeight + 'px)';
        $('.accordion-collapse').css('max-height', maxContentHeight);
    }

    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');

    if(sidebarToggle){
        sidebarToggle.addEventListener('click', () => {
            sidebar.style.transform = sidebar.style.transform === 'translateX(calc(-100% + 30px))' ? 'translateX(0)' : 'translateX(calc(-100% + 30px))';
            // sidebarToggle.style.transform = sidebar.style.transform === 'translateX(-100%)' ? 'translateX(100%)' : 'translateX(0)';
            sidebarToggle.innerHTML = sidebar.style.transform === 'translateX(calc(-100% + 30px))' ? '<svg width="800px" height="800px" viewBox="0 0 24 24" mirror-in-rtl="true"><path fill="#ffffff" d="M10.25 22.987l7.99-9c.51-.57.76-1.28.76-1.99s-.25-1.42-.74-1.98c-.01 0-.01-.01-.01-.01l-.02-.02-7.98-8.98c-1.1-1.24-3.002-1.35-4.242-.25-1.24 1.1-1.35 3-.25 4.23l6.23 7.01-6.23 7.01c-1.1 1.24-.99 3.13.25 4.24 1.24 1.1 3.13.98 4.24-.26z"/></svg>' : '<svg width="800" height="800" viewBox="0 0 24 24" mirror-in-rtl="true"><path fill="#ffffff" d="M13.75 22.987l-7.99-9c-.51-.57-.76-1.28-.76-1.99s.25-1.42.74-1.98c.01 0 .01-.01.01-.01l.02-.02 7.98-8.98c1.1-1.24 3.002-1.35 4.242-.25 1.24 1.1 1.35 3 .25 4.23l-6.23 7.01 6.23 7.01c1.1 1.24.99 3.13-.25 4.24-1.24 1.1-3.13.98-4.24-.26z"/></svg>';
        });
    }

    function extractAndDisplayFigures(article) {
        // Regex pattern to match dollar figures
        const pattern = /\$\d+(?:,\d{3})*(?:\.\d+)?\s?(million|billion|trillion|M|B|T)?/gi;
        // Combine title and content
        const fullText = article.title + " " + article.text;
        // Match all figures
        const figures = fullText.match(pattern);
        // Get calculator figures container
        const figuresContainer = document.getElementById('calculator-figures');

        // Clear previous figures and add new ones
        figuresContainer.innerHTML = '';
        if (figures) {
            figures.forEach(figure => {
                const figureElem = document.createElement('div');
                figureElem.textContent = figure;
                figureElem.classList.add('figure-item'); // Add a class for styling if needed
                figureElem.onclick = function() {
                    document.getElementById('numberInput').value = figure; // When a figure is clicked, it's placed in the input
                    convertNumber(); // And conversion is triggered
                };
                figuresContainer.appendChild(figureElem);
            });
        }
    }

    function onArticleClick(event) {
        // Remove the selected-article class from the previously selected article
        const previousSelectedArticle = document.querySelector(".selected-article");
        if (previousSelectedArticle) {
            previousSelectedArticle.classList.remove("selected-article");
        }
        // Add the selected-article class to the clicked article
        const clickedArticle = event.target.closest("li");
        if (clickedArticle) {
            clickedArticle.classList.add("selected-article");
        }

        // Reset active tab to "JP"
        $('.tabs-container-translation .tab-button').removeClass('active');
        $('.tabs-container-translation .tab-button[data-target="Japanese"]').addClass('active');

        // Load the translated content for "JP" tab
        const selectedArticle = document.querySelector(".selected-article");
        if (selectedArticle) {
            const article = $(selectedArticle).data("article");
            loadTranslation(article, "Japanese");
            // Check if the "Show Edit" button is in "Hide Edit" state, and if so, trigger a click to revert to original
            let toggleEditButton = document.getElementById("toggleEditButton");
            if (toggleEditButton.textContent === "Hide Edit") {
                toggleEditButton.click();
            }
        }

        if (window.location.pathname === '/dashboard') {
            if (selectedArticle) {
                const article = $(selectedArticle).data("article");
                extractAndDisplayFigures(article);
                // Hide the no-article-message and show article-actions
                $("#no-article-message").hide();
                $("#article-actions").show();

                // Define the handlers
                const publishHandler = () => publishArticle(article.id);
                const unpublishHandler = () => unpublishArticle(article.id);
                const saveDraftHandler = () => saveDraft(article.id);

                // Remove any previous event listeners to prevent duplicates
                $("#publish-button").off('click').on('click', publishHandler);
                $("#unpublish-button").off('click').on('click', unpublishHandler);
                $("#save-draft-button").off('click').on('click', saveDraftHandler);

                const articleStatusElem = document.getElementById('article-status');
                articleStatusElem.textContent = '';

            } else {
                // No article is selected, so revert the UI
                $("#article-actions").hide();
                $("#no-article-message").show();
            }

            // let showEdit = false;
            // let toggleButton = document.getElementById("toggleEditButton");
            // toggleButton.addEventListener("click", function() {
            //     if (!currentArticle) {
            //         console.log("No article selected");
            //         return;
            //     }
            //     showEdit = !showEdit;

            //     if (showEdit) {
            //         let formattedEditedContent = `<h3>${currentArticle.edited_japanese_title}</h3>${currentArticle.edited_japanese || ''}`;
            //         tinymce.get("translation-editor").setContent(formattedEditedContent);
            //         toggleButton.textContent = "Hide Edit";
            //     } else {
            //         // Set content back to original translation
            //         let titles = currentArticle.title_translated.split('タイトル').filter(t => t.trim() !== '');
            //         let formattedTitleTranslated = titles.map(t => `<p style="font-weight: 700;margin: 0;">タイトル${t.trim()}</p>`).join('');
            //         tinymce.get("translation-editor").setContent(`<h3>${formattedTitleTranslated}</h3>${currentArticle.content_translated || ''}`);
            //         toggleButton.textContent = "Show Edit";
            //     }
            // });
        }
    }

    function loadTranslation(article, targetLanguage) {
        // Get the active tab language, defaulting to targetLanguage if provided
        var activeLanguage = targetLanguage || $('.tabs-container-translation .active').data('target');
        // Convert the active language to lowercase for field names
        var lowerCaseLanguage = activeLanguage.toLowerCase();
        // Reference to the edit toggle button
        // var toggleEditButton = document.getElementById("toggleEditButton");
        // Set the content based on the active language
        if (activeLanguage === "Japanese") {
            // Set content to Japanese translated version
            tinymce.get("translation-editor").setContent(`<h3>${article.title_translated}</h3>${article.content_translated || ''}`);
            // Show the edit toggle button
            // toggleEditButton.style.display = "block";
        } else {
            // Set content to the translated version of the current active language
            tinymce.get("translation-editor").setContent(`<h3>${article['title_' + lowerCaseLanguage]}</h3>${article['text_' + lowerCaseLanguage] || ''}`);
            // Hide the edit toggle button
            // toggleEditButton.style.display = "none";
        }
    }

    function syncTinyMCEScroll(editor) {
        var syncScrolling = false;
        var originalScrollContainer = $(".scroll-container").not(".tox-edit-area__iframe").get(0);
        var iframeWindow = editor.getWin();
        var iframeBody = editor.getBody();

        iframeWindow.addEventListener("scroll", function () {
          if (!syncScrolling) {
            syncScrolling = true;
            originalScrollContainer.scrollTop = iframeWindow.pageYOffset;
            syncScrolling = false;
          }
        });

        $(originalScrollContainer).scroll(function () {
          if (!syncScrolling) {
            syncScrolling = true;
            iframeWindow.scrollTo(0, originalScrollContainer.scrollTop);
            syncScrolling = false;
          }
        });

        // Trigger the scroll synchronization after the content is loaded into the TinyMCE editor
        editor.on('LoadContent', function () {
          setTimeout(function () {
            originalScrollContainer.scrollTop = iframeBody.scrollTop;
          }, 100);
        });
    }

    const mobileTabButtons = document.querySelectorAll('.mobile-tabs .tab-button');
    const tabs = document.querySelectorAll('.tab');

    if(mobileTabButtons){
        mobileTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const target = button.getAttribute('data-target');
                // Update button active state
                mobileTabButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-target') === target);
                });
                // Show/hide tabs
                tabs.forEach(tab => {
                    tab.style.display = tab.getAttribute('id') === target ? 'block' : 'none';
                });
            });
        });
    }

    $('.tabs-container-translation .tab-button').on('click', function() {
        $('.tabs-container-translation .tab-button').removeClass('active');
        $(this).addClass('active');

        // Load the translated content based on the new active tab
        const selectedArticle = document.querySelector(".selected-article");
        if (selectedArticle) {
          const article = $(selectedArticle).data("article");
          loadTranslation(article);
        }
    });

    // Extract title and content from TinyMCE editor
    function extractArticleContentFromEditor() {
        const fullContent = tinymce.get("translation-editor").getContent();
        const $clonedContent = $(`<div>${fullContent}</div>`);  // Wrap in div to ensure it's a single element
        const articleTitle = $clonedContent.find('h3').text();
        $clonedContent.find('h3').remove();  // Remove the title from the cloned content
        const articleContent = $clonedContent.html();  // Get the modified content from the cloned element

        // console.log('Extracted Title:', articleTitle);
        // console.log('Extracted Content:', articleContent);

        return { articleTitle, articleContent };
    }

    function constructPayload() {
        const { articleTitle, articleContent } = extractArticleContentFromEditor();
        const activeLanguage = $('.tabs-container-translation .active').data('target');

        let payload = {
            title: articleTitle,
            content: articleContent,
            activeLanguage: activeLanguage
        };

        // Set the translated content fields based on the active language
        if (activeLanguage === "Japanese") {
            payload.title_translated = articleTitle;
            payload.content_translated = articleContent;
        } else {
            payload[`title_${activeLanguage.toLowerCase()}`] = articleTitle;
            payload[`text_${activeLanguage.toLowerCase()}`] = articleContent;
        }

        return payload;
    }

    function publishArticle(articleId) {
        const payload = constructPayload();
        handleArticleAction(`/api/publish_article/${articleId}`, payload);
    }

    function saveDraft(articleId) {
        const payload = constructPayload();
        handleArticleAction(`/api/save_draft/${articleId}`, payload);
    }

    function unpublishArticle(articleId) {
        const activeLanguage = $('.tabs-container-translation .active').data('target');
        handleArticleAction(`/api/unpublish_article/${articleId}/${activeLanguage}`, {});
    }

    function handleArticleAction(endpoint, payload) {
        let timeoutId; // Declare timeoutId outside of fetch to have access to it in both success and error cases
        console.log('Payload:', payload);
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const articleStatusElem = document.getElementById('article-status');
            // Clear any existing timeout to ensure old messages are properly hidden
            if(timeoutId) clearTimeout(timeoutId);

            if (data.success) {
                console.log(data.message);
                articleStatusElem.textContent = data.message;
                articleStatusElem.style.color = 'green';
                // Setup the timeout to hide the message after 3 seconds
                timeoutId = setTimeout(() => {
                    articleStatusElem.style.display = 'none';
                }, 3000);
            } else {
                console.log('Failed to process article');
                articleStatusElem.textContent = 'Failed to process article';
                articleStatusElem.style.color = 'red';
                // Setup the timeout to hide the message after 3 seconds
                timeoutId = setTimeout(() => {
                    articleStatusElem.style.display = 'none';
                }, 3000);
            }

            // Ensure the articleStatusElem is visible every time there is a new status
            articleStatusElem.style.display = 'block';
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error.message);
            const articleStatusElem = document.getElementById('article-status');
            // Clear any existing timeout to ensure old messages are properly hidden
            if(timeoutId) clearTimeout(timeoutId);
            articleStatusElem.textContent = 'There was a problem with the network request.';
            articleStatusElem.style.color = 'red';

            // Setup the timeout to hide the message after 3 seconds
            timeoutId = setTimeout(() => {
                articleStatusElem.style.display = 'none';
            }, 3000);

            // Ensure the articleStatusElem is visible every time there is a new status
            articleStatusElem.style.display = 'block';
        });
    }

});

////////////////////
// Convert to Japanese numbers
function convertToJapanese(num, conversionRate = 151) {
    let convertedNumber = num * conversionRate;
    const units = ['', '万', '億', '兆'];
    let result = '';

    for (let i = units.length - 1; i >= 0; i--) {
        let divisor = Math.pow(10000, i);
        if (convertedNumber >= divisor) {
            let unitValue = Math.floor(convertedNumber / divisor);
            result += unitValue + units[i];
            convertedNumber %= divisor;
        }
    }

    // Adding the '円' symbol at the end of the formatted number
    result += '円';

    return result;
}

function parseInput(input) {
    input = input.replace(/[$,]/g, '');  // Remove dollar signs and commas

    let multiplier = 1;

    if (/M|m|million|Million/.test(input)) {
        multiplier = 1e6;
        input = input.replace(/(M|m|million|Million)\s*/g, '');
    } else if (/B|b|billion|Billion/.test(input)) {
        multiplier = 1e9;
        input = input.replace(/(B|b|billion|Billion)\s*/g, '');
    } else if (/T|t|trillion|Trillion/.test(input)) {
        multiplier = 1e12;
        input = input.replace(/(T|t|trillion|Trillion)\s*/g, '');
    }

    // Extract only the first number found in the string
    const numMatch = input.match(/\d+(\.\d+)?/);
    const num = numMatch ? parseFloat(numMatch[0]) : NaN;

    if (isNaN(num)) {
        return NaN;
    }

    return num * multiplier;
}

function convertNumber() {
    const input = document.getElementById('numberInput').value;
    const num = parseInput(input);
    if (!isNaN(num)) {
        const japaneseNumber = convertToJapanese(num);
        document.getElementById('result').innerText = japaneseNumber;

        // Copy result to clipboard
        navigator.clipboard.writeText(japaneseNumber)
            .then(() => {
                console.log('Result copied to clipboard');
            })
            .catch(err => {
                console.error('Error in copying text: ', err);
            });

    } else {
        console.log('Please enter a valid number');
    }
}

function copyResult() {
    var resultDiv = document.getElementById('result');
    var resultText = resultDiv.innerText;
    if (resultText) {
        var tempInput = document.createElement('input');
        document.body.appendChild(tempInput);
        tempInput.value = resultText;
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        resultDiv.innerText = 'Copied';
        resultDiv.style.color = 'green';
        setTimeout(function () {
            resultDiv.innerText = resultText;
            resultDiv.style.color = 'black';
        }, 1000);
    }
}

document.addEventListener('mouseup', function() {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        const numberInput = document.getElementById('numberInput');
        const convertButton = document.querySelector('.calculator button');

        numberInput.value = selectedText;
        convertButton.click();
    }
});



