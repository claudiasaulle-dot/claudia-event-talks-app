// Global Application State
let releases = [];
let filteredReleases = [];
let selectedRelease = null;
let searchTerm = '';
let activeFilter = 'all';

// Constants for UI
const TWITTER_CHAR_LIMIT = 280;
const TWITTER_URL_LENGTH = 23; // Twitter counts any link as exactly 23 characters

// Elements cache
const elements = {
    refreshBtn: document.getElementById('refresh-btn'),
    statusMessage: document.getElementById('status-message'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    releasesContainer: document.getElementById('releases-container'),
    composerEmptyState: document.getElementById('composer-empty-state'),
    composerEditorState: document.getElementById('composer-editor-state'),
    previewCategory: document.getElementById('preview-category'),
    previewDate: document.getElementById('preview-date'),
    previewTitle: document.getElementById('preview-title'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCountText: document.getElementById('char-count-text'),
    counterProgressRing: document.getElementById('counter-progress-ring'),
    composerWarning: document.getElementById('composer-warning'),
    copyTweetBtn: document.getElementById('copy-tweet-btn'),
    shareTweetBtn: document.getElementById('share-tweet-btn')
};

// ==========================================================================
// Initialization & Event Listeners
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Load initial feed
    fetchReleases();
    
    // Refresh feed event
    elements.refreshBtn.addEventListener('click', () => {
        fetchReleases(true);
    });
    
    // Search filter event
    elements.searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.trim();
        elements.clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        applyFilters();
    });
    
    // Clear search event
    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        searchTerm = '';
        elements.clearSearchBtn.style.display = 'none';
        elements.searchInput.focus();
        applyFilters();
    });
    
    // Category filter button click events
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all, add to clicked
            filterButtons.forEach(b => b.classList.remove('active'));
            const button = e.currentTarget;
            button.classList.add('active');
            
            activeFilter = button.getAttribute('data-filter');
            applyFilters();
        });
    });
    
    // Tweet composer input updates character count
    elements.tweetTextarea.addEventListener('input', () => {
        updateCharacterCounter();
    });
    
    // Copy tweet text to clipboard
    elements.copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    
    // Share on Twitter Web Intent
    elements.shareTweetBtn.addEventListener('click', shareOnTwitter);
});

// ==========================================================================
// Data Fetching & State Management
// ==========================================================================
async function fetchReleases(forceRefresh = false) {
    // Show spinner loading
    const spinner = elements.refreshBtn.querySelector('.spinner-icon');
    spinner.classList.add('spinning');
    elements.refreshBtn.disabled = true;
    
    updateStatus('fetching', 'Syncing with Google feed...');
    
    // Reset selections when refreshing
    if (forceRefresh) {
        deselectRelease();
    }
    
    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (response.ok && result.success) {
            releases = result.data;
            applyFilters();
            
            // Format last updated date
            const date = new Date(result.last_updated * 1000);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            if (result.source === 'cache') {
                updateStatus('success', `Cached (synced at ${timeStr})`);
            } else {
                updateStatus('success', `Synced at ${timeStr}`);
            }
        } else {
            console.error("API error:", result.error);
            if (result.data && result.data.length > 0) {
                // Fallback stale data rendered
                releases = result.data;
                applyFilters();
                updateStatus('error', `Offline. Showing cached feed.`);
            } else {
                renderErrorState(result.error || "Failed to parse feed data");
                updateStatus('error', 'Sync failed');
            }
        }
    } catch (error) {
        console.error("Fetch error:", error);
        renderErrorState("Could not connect to the local server. Make sure the Flask app is running.");
        updateStatus('error', 'Connection failed');
    } finally {
        spinner.classList.remove('spinning');
        elements.refreshBtn.disabled = false;
    }
}

function updateStatus(state, message) {
    elements.statusMessage.className = 'status-msg';
    const icon = elements.statusMessage.querySelector('i');
    const text = elements.statusMessage.querySelector('span');
    
    text.textContent = message;
    
    if (state === 'fetching') {
        icon.className = 'fa-solid fa-circle-notch fa-spin';
    } else if (state === 'success') {
        icon.className = 'fa-solid fa-circle-check text-success';
    } else if (state === 'error') {
        icon.className = 'fa-solid fa-triangle-exclamation';
        elements.statusMessage.classList.add('error');
    }
}

// ==========================================================================
// Filtering & Render Logic
// ==========================================================================
function applyFilters() {
    filteredReleases = releases.filter(release => {
        // Category Filter
        const matchesCategory = (activeFilter === 'all' || release.category === activeFilter);
        
        // Search Term Filter
        const query = searchTerm.toLowerCase();
        const matchesSearch = !query || 
            release.date.toLowerCase().includes(query) || 
            release.category.toLowerCase().includes(query) || 
            release.content_text.toLowerCase().includes(query);
            
        return matchesCategory && matchesSearch;
    });
    
    renderReleasesList();
}

function renderReleasesList() {
    elements.releasesContainer.innerHTML = '';
    
    if (filteredReleases.length === 0) {
        renderNoResultsState();
        return;
    }
    
    filteredReleases.forEach(release => {
        const card = document.createElement('article');
        card.className = `release-card ${selectedRelease && selectedRelease.id === release.id ? 'selected' : ''}`;
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-pressed', selectedRelease && selectedRelease.id === release.id ? 'true' : 'false');
        card.dataset.id = release.id;
        
        // Determine category badge class
        let badgeClass = 'badge-general';
        if (release.category === 'Feature') badgeClass = 'badge-feature';
        else if (release.category === 'Change') badgeClass = 'badge-change';
        else if (release.category === 'Deprecated') badgeClass = 'badge-deprecation';
        
        // Formulate a card title from the first 50 chars of content or category
        let cardTitle = release.content_text.split('.')[0];
        if (cardTitle.length > 70) {
            cardTitle = cardTitle.substring(0, 67) + '...';
        }
        
        card.innerHTML = `
            <div class="card-meta">
                <time class="card-date" datetime="${release.date}">
                    <i class="fa-regular fa-calendar"></i> ${release.date}
                </time>
                <span class="badge ${badgeClass}">${release.category}</span>
            </div>
            
            <div class="card-body">
                ${release.content_html}
            </div>
            
            <div class="card-footer">
                <a href="${release.link}" class="source-link" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Original release notes
                </a>
                <span class="action-trigger">
                    <i class="fa-brands fa-x-twitter"></i> Select to Tweet
                </span>
            </div>
        `;
        
        // Card Click Handler
        card.addEventListener('click', () => {
            selectRelease(release);
        });
        
        // Card keyboard navigation handler
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectRelease(release);
            }
        });
        
        elements.releasesContainer.appendChild(card);
    });
}

function renderErrorState(message) {
    elements.releasesContainer.innerHTML = `
        <div class="error-state">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <h3>Unable to load releases</h3>
            <p>${message}</p>
            <button class="btn btn-secondary" onclick="fetchReleases(true)">Try Again</button>
        </div>
    `;
}

function renderNoResultsState() {
    elements.releasesContainer.innerHTML = `
        <div class="no-results-state">
            <i class="fa-solid fa-clipboard-question"></i>
            <h3>No results found</h3>
            <p>We couldn't find any release notes matching "<strong>${searchTerm}</strong>" in the selected category.</p>
        </div>
    `;
}

// ==========================================================================
// Tweet Composer & Selection Logic
// ==========================================================================
function selectRelease(release) {
    selectedRelease = release;
    
    // Re-render list to show selected border glow
    const cards = elements.releasesContainer.querySelectorAll('.release-card');
    cards.forEach(card => {
        if (card.dataset.id === release.id) {
            card.classList.add('selected');
            card.setAttribute('aria-pressed', 'true');
        } else {
            card.classList.remove('selected');
            card.setAttribute('aria-pressed', 'false');
        }
    });
    
    // Render composer panel
    elements.composerEmptyState.style.display = 'none';
    elements.composerEditorState.style.display = 'flex';
    
    // Set preview details
    elements.previewCategory.textContent = release.category;
    // Set preview badge theme
    elements.previewCategory.className = 'badge';
    if (release.category === 'Feature') elements.previewCategory.classList.add('badge-feature');
    else if (release.category === 'Change') elements.previewCategory.classList.add('badge-change');
    else if (release.category === 'Deprecated') elements.previewCategory.classList.add('badge-deprecation');
    else elements.previewCategory.classList.add('badge-general');
    
    elements.previewDate.textContent = release.date;
    
    // Make a short snippet for the preview title
    let previewTitleText = release.content_text.split('.')[0];
    elements.previewTitle.textContent = previewTitleText;
    
    // Pre-populate textarea with custom formatted tweet draft
    elements.tweetTextarea.value = generateDefaultTweet(release);
    
    // Recalculate length & progress ring
    updateCharacterCounter();
    
    // On small screens, scroll the tweet composer into view smoothly
    if (window.innerWidth <= 1024) {
        elements.composerEditorState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function deselectRelease() {
    selectedRelease = null;
    elements.composerEmptyState.style.display = 'flex';
    elements.composerEditorState.style.display = 'none';
}

function generateDefaultTweet(release) {
    const categoryEmoji = {
        'Feature': '🚀 Feature',
        'Change': '🔄 Change',
        'Deprecated': '⚠️ Deprecated',
        'General': '📢 Update'
    }[release.category] || '📢 Update';
    
    const prefix = `${categoryEmoji} on BigQuery (${release.date}):\n\n`;
    const suffix = `\n\nRead details: ${release.link}`;
    
    // Calculate characters consumed by static parts (prefix, suffix with Twitter's 23-char link rule)
    const suffixWithShortLink = suffix.replace(release.link, 'A'.repeat(TWITTER_URL_LENGTH));
    const reservedChars = prefix.length + suffixWithShortLink.length;
    
    const maxDescLength = TWITTER_CHAR_LIMIT - reservedChars;
    
    let description = release.content_text;
    if (description.length > maxDescLength) {
        // Truncate at word boundary if possible, to fit max description length
        let truncated = description.substring(0, maxDescLength - 3);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > maxDescLength / 2) {
            truncated = truncated.substring(0, lastSpace);
        }
        description = truncated + '...';
    }
    
    return `${prefix}${description}${suffix}`;
}

// ==========================================================================
// X/Twitter Character Counting (Accurate to X Link Rules)
// ==========================================================================
function calculateTwitterTextLength(text) {
    // Match http:// and https:// links
    const urlRegex = /https?:\/\/[^\s]+/g;
    let textWithoutUrls = text;
    let urlMatches = text.match(urlRegex) || [];
    
    // Remove matches to get raw characters length
    urlMatches.forEach(url => {
        textWithoutUrls = textWithoutUrls.replace(url, '');
    });
    
    // Add 23 characters for each URL, plus the length of remaining text
    return textWithoutUrls.length + (urlMatches.length * TWITTER_URL_LENGTH);
}

function updateCharacterCounter() {
    const text = elements.tweetTextarea.value;
    const count = calculateTwitterTextLength(text);
    
    const remaining = TWITTER_CHAR_LIMIT - count;
    elements.charCountText.textContent = remaining;
    
    // Update Counter ring
    const radius = elements.counterProgressRing.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    
    elements.counterProgressRing.style.strokeDasharray = `${circumference} ${circumference}`;
    
    // Clamp progress between 0 and 1
    const progress = Math.min(count / TWITTER_CHAR_LIMIT, 1);
    const strokeDashoffset = circumference - (progress * circumference);
    elements.counterProgressRing.style.strokeDashoffset = strokeDashoffset;
    
    // Visual indicators for limits
    if (remaining < 0) {
        elements.charCountText.classList.add('warning');
        elements.counterProgressRing.style.stroke = '#ef4444'; // Red ring
        elements.composerWarning.style.display = 'flex';
        elements.shareTweetBtn.disabled = true;
    } else if (remaining <= 20) {
        elements.charCountText.classList.add('warning');
        elements.counterProgressRing.style.stroke = '#f59e0b'; // Amber ring
        elements.composerWarning.style.display = 'none';
        elements.shareTweetBtn.disabled = false;
    } else {
        elements.charCountText.classList.remove('warning');
        elements.counterProgressRing.style.stroke = '#3b82f6'; // Blue ring
        elements.composerWarning.style.display = 'none';
        elements.shareTweetBtn.disabled = false;
    }
}

// ==========================================================================
// Sharing & Clipboard Actions
// ==========================================================================
function copyTweetToClipboard() {
    const text = elements.tweetTextarea.value;
    
    navigator.clipboard.writeText(text).then(() => {
        // Change button layout temporarily to indicate success
        const originalHTML = elements.copyTweetBtn.innerHTML;
        elements.copyTweetBtn.innerHTML = '<i class="fa-solid fa-check text-success"></i> Copied!';
        elements.copyTweetBtn.classList.add('success');
        elements.copyTweetBtn.disabled = true;
        
        setTimeout(() => {
            elements.copyTweetBtn.innerHTML = originalHTML;
            elements.copyTweetBtn.classList.remove('success');
            elements.copyTweetBtn.disabled = false;
        }, 2000);
    }).catch(err => {
        console.error("Failed to copy:", err);
        alert("Unable to copy to clipboard automatically. Please select and copy manually.");
    });
}

function shareOnTwitter() {
    const text = elements.tweetTextarea.value;
    
    // Open Twitter Web Intent URL in new tab
    const twitterIntentURL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterIntentURL, '_blank', 'noopener,noreferrer');
}
