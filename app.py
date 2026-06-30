import time
import urllib.request
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Cache configuration: 5 minutes cache lifetime
CACHE_DURATION = 300  
cache = {
    "data": None,
    "last_updated": 0
}

def clean_html_content(soup):
    """
    Cleans up absolute links in the Google Cloud documentation to open in new tabs
    and ensures proper spacing around standard HTML elements.
    """
    for a in soup.find_all('a'):
        # Ensure external links have target="_blank"
        a['target'] = '_blank'
        a['rel'] = 'noopener noreferrer'
        # If link is relative, prefix with GCP docs domain
        if a.get('href', '').startswith('/'):
            a['href'] = 'https://cloud.google.com' + a['href']
    return str(soup).strip()

def fetch_and_parse_feed():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    
    # Set user agent to avoid blocking
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    
    with urllib.request.urlopen(req) as response:
        xml_data = response.read()
        
    # Parse the XML Atom Feed
    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = root.findall('atom:entry', ns)
    parsed_notes = []
    
    for entry in entries:
        # Date of the release note
        date_str = entry.find('atom:title', ns).text
        
        # Link to the release note entry
        link_elem = entry.find('atom:link', ns)
        link = link_elem.attrib.get('href') if link_elem is not None else ""
        
        # Entry ID
        entry_id_elem = entry.find('atom:id', ns)
        entry_id = entry_id_elem.text if entry_id_elem is not None else ""
        
        content_elem = entry.find('atom:content', ns)
        if content_elem is None or content_elem.text is None:
            continue
            
        content_html = content_elem.text
        soup = BeautifulSoup(content_html, 'html.parser')
        
        # Split notes by h3 tags (categories)
        headers = soup.find_all('h3')
        
        if not headers:
            # Fallback if no subheaders exist
            text_content = " ".join(soup.get_text().split())
            clean_html = clean_html_content(soup)
            parsed_notes.append({
                "id": entry_id,
                "date": date_str,
                "category": "General",
                "content_html": clean_html,
                "content_text": text_content,
                "link": link
            })
        else:
            for idx, header in enumerate(headers):
                category = header.get_text().strip()
                
                # Fetch all subsequent siblings until the next h3 header
                siblings = []
                curr = header.next_sibling
                while curr and curr.name != 'h3':
                    siblings.append(curr)
                    curr = curr.next_sibling
                
                # Create a temporary container for siblings to render HTML/text
                sibling_soup = BeautifulSoup("", 'html.parser')
                for sib in siblings:
                    sibling_soup.append(BeautifulSoup(str(sib), 'html.parser'))
                
                clean_html = clean_html_content(sibling_soup)
                text_content = " ".join(sibling_soup.get_text().split())
                
                # Generate unique ID for the sub-release note
                sub_id = f"{entry_id}#{idx}"
                
                parsed_notes.append({
                    "id": sub_id,
                    "date": date_str,
                    "category": category,
                    "content_html": clean_html,
                    "content_text": text_content,
                    "link": link
                })
                
    return parsed_notes

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    if refresh or cache["data"] is None or (now - cache["last_updated"]) > CACHE_DURATION:
        try:
            cache["data"] = fetch_and_parse_feed()
            cache["last_updated"] = now
            return jsonify({
                "success": True,
                "data": cache["data"],
                "source": "fresh",
                "last_updated": cache["last_updated"]
            })
        except Exception as e:
            # Serve stale cache if available, else fail
            if cache["data"] is not None:
                return jsonify({
                    "success": False,
                    "error": str(e),
                    "data": cache["data"],
                    "source": "stale_fallback",
                    "last_updated": cache["last_updated"]
                })
            return jsonify({
                "success": False,
                "error": str(e),
                "data": []
            }), 500
            
    return jsonify({
        "success": True,
        "data": cache["data"],
        "source": "cache",
        "last_updated": cache["last_updated"]
    })

if __name__ == '__main__':
    # Running locally on localhost:5001 to avoid conflicts with macOS AirPlay (port 5000)
    app.run(host='0.0.0.0', port=5001, debug=True)
