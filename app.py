from flask import Flask, request, jsonify
import spacy

app = Flask(__name__)
nlp = spacy.load('en_core_web_sm')

# Your book database (for example purpose)
BOOKS = [
    {"title": "Learning Python", "author": "Mark Lutz"},
    {"title": "Automate the Boring Stuff", "author": "Al Sweigart"},
    {"title": "Deep Learning", "author": "Ian Goodfellow"},
]

@app.route('/search', methods=['POST'])
def search_books():
    data = request.get_json()
    query = data.get('query', '')
    doc = nlp(query)
    search_entities = [ent.text for ent in doc.ents]
    # Simple filtering: find any book matching an entity (author/title)
    results = []
    for book in BOOKS:
        if any(ent.lower() in book['title'].lower() or ent.lower() in book['author'].lower() for ent in search_entities):
            results.append(book)
    return jsonify({"entities": search_entities, "results": results})

if __name__ == "__main__":
    app.run(debug=True)
