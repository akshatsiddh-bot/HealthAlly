from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    # Example: You pass the predicted specialist type from your diagnosis logic
    predicted_specialist = "Cardiologist" 
    return render_template('map.html', specialist=predicted_specialist)

if __name__ == '__main__':
    app.run(debug=True)