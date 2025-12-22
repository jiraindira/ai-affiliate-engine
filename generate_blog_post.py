from agents.topic_agent import TopicSelectionAgent
from agents.product_agent import ProductDiscoveryAgent
from schemas.topic import TopicInput
from datetime import date
from pathlib import Path
import json
import subprocess
import re

def main():
    print(">>> generate_blog_post.py started")

    # 1️⃣ Generate Topic
    topic_agent = TopicSelectionAgent()
    input_data = TopicInput(current_date=date.today().isoformat(), region="US")
    try:
        topic = topic_agent.run(input_data)
        print("✅ Topic generated:", topic.topic)
    except Exception as e:
        print("Error generating topic:", e)
        return

    # 2️⃣ Generate Products
    product_agent = ProductDiscoveryAgent()
    try:
        products = product_agent.run(topic)
        print(f"✅ {len(products)} products generated")
    except Exception as e:
        print("Error generating products:", e)
        return

    # 3️⃣ Filter & sort products
    products = [p for p in products if p.rating >= 4.0 and p.reviews_count >= 250]
    products = sorted(products, key=lambda p: (p.rating, p.reviews_count), reverse=True)

    # 4️⃣ Generate Markdown with Jekyll front-matter
    # Sanitize filename for Windows and Git
    safe_topic = re.sub(r"[^\w\-]", "-", topic.topic.replace(" ", "-"))
    filename = f"{date.today().isoformat()}-{safe_topic}.md"

    output_path = Path("_posts")
    output_path.mkdir(exist_ok=True)
    file_path = output_path / filename

    md_content = f"""---
layout: post
title: "{topic.topic}"
date: {date.today().isoformat()}
categories: {topic.category}
audience: {topic.audience}
---

# {topic.topic}

*Audience:* {topic.audience}  
*Category:* {topic.category}  
*Rationale:* {topic.rationale}

## Top Products:

"""
    for idx, p in enumerate(products, start=1):
        md_content += f"""### {idx}. {p.title}
- Price: {p.price}
- Rating: {p.rating}⭐ ({p.reviews_count} reviews)
- Link: {p.url}
- Description: {p.description}

"""

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"✅ Blog post saved to {file_path}")

    # 5️⃣ Log post
    log_path = Path("output/posts_log.json")
    log_path.parent.mkdir(exist_ok=True)
    if log_path.exists():
        try:
            log_data = json.loads(log_path.read_text(encoding="utf-8"))
        except Exception:
            log_data = []
    else:
        log_data = []

    log_entry = {
        "date": date.today().isoformat(),
        "topic": topic.topic,
        "category": topic.category,
        "filename": str(file_path)
    }
    log_data.append(log_entry)
    log_path.write_text(json.dumps(log_data, indent=2), encoding="utf-8")
    print(f"✅ Post logged in {log_path}")

    # 6️⃣ Git commit & push
    try:
        # Force-add the generated blog post and log file
        subprocess.run(["git", "add", "-f", str(file_path)], check=True)
        subprocess.run(["git", "add", "-f", str(log_path)], check=True)

        commit_message = f"Add blog post: {topic.topic} ({date.today().isoformat()})"
        subprocess.run(["git", "commit", "-m", commit_message], check=True)
        subprocess.run(["git", "push", "origin", "main"], check=True)
        print(f"✅ Blog post pushed to GitHub")
    except subprocess.CalledProcessError as e:
        print(f"⚠️ Git push failed: {e}")

if __name__ == "__main__":
    main()
