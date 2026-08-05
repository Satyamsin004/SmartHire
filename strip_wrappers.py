import os
import re

PAGES_DIR = r"E:\coding\projects\hiringproject\frontend\src\pages"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Remove Sidebar and Navbar imports
    content = re.sub(r"import\s*\{\s*Sidebar\s*\}\s*from\s*['\"].*Sidebar['\"];?\n?", "", content)
    content = re.sub(r"import\s*\{\s*Navbar\s*\}\s*from\s*['\"].*Navbar['\"];?\n?", "", content)
    
    # Find the top wrapper:
    # return (
    #   <div className="min-h-screen bg-brand-bg flex text-brand-ink font-sans">
    #     <Sidebar />
    #     <div className="flex-1 flex flex-col min-w-0">
    #       <Navbar />
    
    pattern = r'(return\s*\(\s*)<div\s+className=["\'][^"\']*min-h-screen[^"\']*["\'][^>]*>\s*<Sidebar\s*/>\s*<div\s+className=["\'][^"\']*flex-1[^"\']*["\'][^>]*>\s*<Navbar\s*(?:userName=\{[^}]*\})?\s*/>'
    
    match = re.search(pattern, content)
    if match:
        content = content[:match.start()] + match.group(1) + "<>" + content[match.end():]
        
        # Now we need to remove two closing </div>s at the very end of the file.
        # Find the last two </div>
        divs = list(re.finditer(r'</div>', content))
        if len(divs) >= 2:
            last_two = divs[-2:]
            # We replace them with </> (one of them) and remove the other.
            # Actually, the outermost wrapper is </> so we replace the last two </div>s with </>
            content = content[:last_two[0].start()] + "</>" + content[last_two[-1].end():]
    
    # Try alternate pattern where Navbar doesn't have Sidebar (if any)
    else:
        # Some files might just have Sidebar, or just Navbar
        content = re.sub(r"^\s*<Sidebar\s*/>\s*\n?", "", content, flags=re.MULTILINE)
        content = re.sub(r"^\s*<Navbar(\s+userName=\{[^}]*\})?\s*/>\s*\n?", "", content, flags=re.MULTILINE)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return original != content

def main():
    for root, dirs, files in os.walk(PAGES_DIR):
        for file in files:
            if file.endswith(".tsx") and file != "LiveInterviewRoom.tsx":
                filepath = os.path.join(root, file)
                changed = process_file(filepath)
                if changed:
                    print(f"Processed: {filepath}")

if __name__ == "__main__":
    main()
