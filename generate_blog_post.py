from agents.topic_agent import TopicSelectionAgent
from agents.product_agent import ProductDiscoveryAgent
from schemas.topic import TopicInput
from datetime import date
from pathlib import Path

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

    # 3️⃣ Create Markdown content
    md_content = f"# {topic.topic}\n\n"
    md_content += f"*Audience:* {topic.audience}\n"
    md_content += f"*Rationale:* {topic.rationale}\n\n"
    md_content += "## Top Products:\n\n"
    for idx, p in enumerate(products, start=1):
        md_content += f"### {idx}. {p.title}\n"
        md_content += f"- Price: {p.price}\n"
        md_content += f"- Rating: {p.rating}⭐ ({p.reviews_count} reviews)\n"
        md_content += f"- Link: {p.url}\n"
        md_content += f"- Description: {p.description}\n\n"

    # 4️⃣ Save to file
    safe_topic = topic.topic.replace(" ", "_").replace("/", "-")
    filename = f"blog_{date.today().isoformat()}_{safe_topic}.md"
    output_path = Path("output")
    output_path.mkdir(exist_ok=True)
    file_path = output_path / filename

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"✅ Blog post saved to {file_path}")

if __name__ == "__main__":
    main()
