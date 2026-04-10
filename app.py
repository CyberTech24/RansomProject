from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os
import numpy as np
import pickle
import math
import hashlib
from collections import Counter
from werkzeug.utils import secure_filename

import requests

# Ollama Endpoint Configuration
OLLAMA_API_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "phi3"

# Secure Cryptographic Whitelist (Known Good Installers)
KNOWN_GOOD_HASHES = [
    '194362cf24cd0db4b573096108460a34c7f80a20c5f2aa60d06ef817be9f73a1', # Git Installer
    '0a9530b8227313436447d90fc55c2cf033d48e1f6c2a4d87d907068689392c03', # Ollama Installer
]

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max  ← CHANGED

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

MODEL_PATH = r"C:\Users\THE GHOST\Downloads\RansomwareProject\RansomwareProject\Model\ransomware_detector_xgboost.pkl"
with open(MODEL_PATH, 'rb') as f:
    model = pickle.load(f)

def calculate_entropy(data):
    if not data:
        return 0
    entropy = 0
    for x in range(256):
        p_x = float(data.count(x))/len(data)
        if p_x > 0:
            entropy += - p_x*math.log(p_x, 2)
    return entropy

def calculate_sha256(filepath):
    """Calculates the secure SHA-256 fingerprint of a file."""
    sha256_hash = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest().lower()
    except Exception:
        return ""

def extract_features(filepath):
    try:
        with open(filepath, 'rb') as f:
            data = f.read(100000)
        
        if len(data) == 0:
            return None
        
        byte_hist = np.bincount(np.frombuffer(data, dtype=np.uint8), minlength=256)
        byte_hist = byte_hist / len(data)
        
        entropy = calculate_entropy(data)
        file_size = len(data)
        printable = sum(1 for b in data if 32 <= b <= 126)
        printable_ratio = printable / len(data)
        
        features = np.concatenate([byte_hist, [entropy, file_size, printable_ratio]])
        return features.reshape(1, -1)
    except Exception as e:
        print(f"Error extracting features: {e}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/scan', methods=['POST'])
def scan_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    try:
        features = extract_features(filepath)
        
        if features is None:
            os.remove(filepath)
            return jsonify({'error': 'Could not analyze file'}), 400
        
        file_hash = calculate_sha256(filepath)
        
        # Consult the Enterprise Cryptographic Whitelist
        if file_hash in KNOWN_GOOD_HASHES:
            prediction = 0
            probability = [1.0, 0.0]
        else:
            prediction = model.predict(features)[0]
            probability = model.predict_proba(features)[0]
        
        with open(filepath, 'rb') as f:
            data = f.read(100000)
        entropy = calculate_entropy(data)
        file_size = os.path.getsize(filepath)
        
        os.remove(filepath)
        
        result = {
            'filename': filename,
            'prediction': 'RANSOMWARE/INTRUSION DETECTED' if prediction == 1 else 'FILE IS SAFE',
            'is_ransomware': bool(prediction == 1),
            'confidence': float(probability[prediction] * 100),
            'ransomware_probability': float(probability[1] * 100),
            'benign_probability': float(probability[0] * 100),
            'entropy': float(entropy),
            'file_size': file_size
        }
        
        return jsonify(result)
    
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    log_file = os.path.join(os.path.dirname(__file__), 'logs', 'edr_events.log')
    try:
        if not os.path.exists(log_file):
            return jsonify([])
        with open(log_file, 'r', encoding='utf-8') as f:
            # Read the last 50 lines
            lines = f.readlines()
            # Return last 50, stripped of trailing newlines
            return jsonify([line.strip() for line in lines[-50:]])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports', methods=['GET'])
def get_reports():
    reports_dir = os.path.join(os.path.dirname(__file__), 'forensic_reports')
    try:
        if not os.path.exists(reports_dir):
            return jsonify([])
        
        report_files = sorted(
            [f for f in os.listdir(reports_dir) if f.startswith('INCIDENT_')],
            reverse=True
        )
        
        reports = []
        for rf in report_files[:10]:  # Last 10 reports
            filepath = os.path.join(reports_dir, rf)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            reports.append({
                'filename': rf,
                'content': content,
                'timestamp': os.path.getmtime(filepath)
            })
        
        return jsonify(reports)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)