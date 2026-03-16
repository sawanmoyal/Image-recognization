# Smart Human Activity & Situation Recognition System

A real-time computer vision system that detects humans from images/video frames
and classifies their activities using **MediaPipe Pose** keypoints fed into a
**PyTorch MLP** deep learning model.

## Detected Activities

| Activity | Description |
|---|---|
| 🚶 Walking | Person in upright walking posture |
| 🪑 Sitting | Knees bent, body at rest |
| 🏃 Running | Fast motion, bent knees, leaning forward |
| 🚨 Falling | Body nearly horizontal — **ALERT** |
| 📱 Using Phone | Wrist raised toward face |
| 🥊 Fighting | Arms raised, aggressive posture — **ALERT** |

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.10 |
| Web Framework | Flask + Flask-CORS |
| Pose Estimation | MediaPipe Pose (33 landmarks) |
| Deep Learning | PyTorch (MLP classifier) |
| Computer Vision | OpenCV |
| Data Processing | NumPy, Pandas |
| Visualization | Matplotlib |

## Project Structure

```
smart-human-recognition/
├── dataset/               ← Training CSVs (one per activity)
├── models/                ← Saved PyTorch model (.pth)
├── src/
│   ├── pose_extraction.py ← MediaPipe pose landmark extractor
│   ├── activity_detector.py ← Full detection pipeline
│   └── train_model.py     ← PyTorch model training script
├── webapp/
│   ├── app.py             ← Flask API + web server
│   └── templates/
│       └── index.html     ← Web dashboard UI
├── utils/
│   └── helper.py          ← Logging, CSV, drawing utilities
├── saved_events/          ← Saved frames + event_log.csv
├── requirements.txt
├── run.py                 ← Entry point
└── README.md
```

## Installation

```bash
pip install -r requirements.txt
```

## Running the App

```bash
python run.py
# Open http://localhost:5000
```

## Training Your Own Model

1. Collect pose keypoints for each activity into CSV files in `dataset/`:
   - Each file must have columns `feat_0` … `feat_131` and a `label` column
   - One CSV per activity, e.g. `walking.csv`, `sitting.csv`

2. Run training:
```bash
python src/train_model.py --epochs 50 --lr 0.001 --batch-size 32
```

3. The trained model is saved to `models/activity_classifier.pth`.
   The Flask app will automatically load it on the next restart.

## Dataset Suggestions

| Dataset | Link | Activities |
|---|---|---|
| NTU RGB+D | https://rose1.ntu.edu.sg/dataset/actionRecognition/ | 120 action classes |
| UCF-101 | https://www.crcv.ucf.edu/data/UCF101.php | 101 action categories |
| Kinetics-700 | https://deepmind.com/research/open-source/kinetics | 700 human actions |
| HMDB-51 | https://serre-lab.clps.brown.edu/resource/hmdb-a-large-human-motion-database/ | 51 action classes |
| HAR Dataset | https://archive.ics.uci.edu/ml/datasets/human+activity+recognition | Accelerometer-based |

## API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/` | Web dashboard |
| POST | `/analyze` | Upload image → activity detections |
| GET | `/events` | Event log JSON |
| DELETE | `/events` | Clear event log |
| GET | `/events/export` | Download events as CSV |
| GET | `/stats` | Activity statistics JSON |
| GET | `/health` | Health check |

## Module Descriptions

### `src/pose_extraction.py`
Wraps MediaPipe Pose to extract 33 body landmark coordinates (x, y, z, visibility) from each frame.
Outputs a 132-dimensional feature vector for the classifier, plus bounding box and annotated frame.

### `src/activity_detector.py`
Full pipeline combining pose extraction with classification. Uses the trained PyTorch model when
available; falls back to geometric heuristics (joint angles) otherwise.

### `src/train_model.py`
PyTorch MLP training script. Architecture: 132 → 256 → 128 → 64 → 6 with BatchNorm and Dropout.
Saves the best model checkpoint based on validation accuracy.

### `webapp/app.py`
Flask web server exposing the REST API and serving the dashboard HTML.

### `utils/helper.py`
Shared utilities: CSV event logging, frame saving for special events, OpenCV drawing helpers.
