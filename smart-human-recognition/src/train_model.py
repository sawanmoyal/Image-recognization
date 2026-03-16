"""
train_model.py — Train a PyTorch MLP classifier on pose keypoint features.

Architecture:
    Input  → 132 features (33 landmarks × 4 values each)
    Hidden → 256 → 128 → 64 neurons (ReLU + BatchNorm + Dropout)
    Output → 6 classes (walking, sitting, running, falling, using_phone, fighting)

Dataset format expected in dataset/:
    One CSV per activity, columns: feat_0 … feat_131, label

Usage:
    python src/train_model.py --epochs 50 --lr 0.001 --batch-size 32

The trained model is saved to models/activity_classifier.pth.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset, random_split

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ── Labels ───────────────────────────────────────────────────────────────────

ACTIVITY_LABELS = ["walking", "sitting", "running", "falling", "using_phone", "fighting"]
LABEL_TO_IDX = {label: idx for idx, label in enumerate(ACTIVITY_LABELS)}
NUM_CLASSES = len(ACTIVITY_LABELS)
INPUT_DIM = 132  # 33 landmarks × 4


# ── Dataset ──────────────────────────────────────────────────────────────────

class PoseDataset(Dataset):
    """Loads pose feature vectors and integer activity labels."""

    def __init__(self, features: np.ndarray, labels: np.ndarray) -> None:
        self.X = torch.tensor(features, dtype=torch.float32)
        self.y = torch.tensor(labels, dtype=torch.long)

    def __len__(self) -> int:
        return len(self.y)

    def __getitem__(self, idx: int):
        return self.X[idx], self.y[idx]


def load_dataset(dataset_dir: str) -> tuple[np.ndarray, np.ndarray]:
    """
    Load CSV files from dataset_dir. Each CSV must have:
        - Columns feat_0 … feat_131 (pose features)
        - A 'label' column with the activity string

    Returns:
        (features, labels) as numpy arrays.
    """
    import pandas as pd

    all_features, all_labels = [], []
    for fname in os.listdir(dataset_dir):
        if not fname.endswith(".csv"):
            continue
        fpath = os.path.join(dataset_dir, fname)
        df = pd.read_csv(fpath)
        if "label" not in df.columns:
            logger.warning("Skipping %s — no 'label' column found.", fname)
            continue
        labels = df["label"].map(LABEL_TO_IDX).values
        features = df[[f"feat_{i}" for i in range(INPUT_DIM)]].values
        all_features.append(features.astype(np.float32))
        all_labels.append(labels)
        logger.info("Loaded %d samples from %s", len(df), fname)

    if not all_features:
        raise FileNotFoundError(f"No valid CSV files found in {dataset_dir}")

    return np.concatenate(all_features), np.concatenate(all_labels)


# ── Model ────────────────────────────────────────────────────────────────────

class ActivityClassifierMLP(nn.Module):
    """
    Multilayer Perceptron for human activity classification.

    Takes 132-dimensional pose feature vectors and outputs
    class logits for 6 activity categories.
    """

    def __init__(self, input_dim: int = INPUT_DIM, num_classes: int = NUM_CLASSES,
                 dropout: float = 0.4) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(dropout),

            nn.Linear(256, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(dropout),

            nn.Linear(128, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(dropout / 2),

            nn.Linear(64, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ── Training loop ─────────────────────────────────────────────────────────────

def train(args: argparse.Namespace) -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Training on device: %s", device)

    # Load data
    features, labels = load_dataset(args.dataset_dir)
    dataset = PoseDataset(features, labels)

    val_size = int(len(dataset) * 0.2)
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size)

    # Model, loss, optimizer
    model = ActivityClassifierMLP().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_val_acc = 0.0
    os.makedirs(args.model_dir, exist_ok=True)
    best_path = os.path.join(args.model_dir, "activity_classifier.pth")

    for epoch in range(1, args.epochs + 1):
        # ── Train ──
        model.train()
        train_loss, train_correct = 0.0, 0
        for X_batch, y_batch in train_loader:
            X_batch, y_batch = X_batch.to(device), y_batch.to(device)
            optimizer.zero_grad()
            logits = model(X_batch)
            loss = criterion(logits, y_batch)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(y_batch)
            train_correct += (logits.argmax(1) == y_batch).sum().item()

        # ── Validate ──
        model.eval()
        val_correct = 0
        with torch.no_grad():
            for X_batch, y_batch in val_loader:
                X_batch, y_batch = X_batch.to(device), y_batch.to(device)
                val_correct += (model(X_batch).argmax(1) == y_batch).sum().item()

        train_acc = train_correct / train_size
        val_acc = val_correct / val_size
        scheduler.step()

        logger.info(
            "Epoch %3d/%d | Train Loss: %.4f | Train Acc: %.2f%% | Val Acc: %.2f%%",
            epoch, args.epochs,
            train_loss / train_size,
            train_acc * 100,
            val_acc * 100,
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "val_acc": val_acc,
                "labels": ACTIVITY_LABELS,
            }, best_path)
            logger.info("  ✓ New best model saved (val_acc=%.2f%%)", val_acc * 100)

    logger.info("Training complete. Best val accuracy: %.2f%%", best_val_acc * 100)
    logger.info("Model saved to: %s", best_path)


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train pose-based activity classifier")
    root = os.path.join(os.path.dirname(__file__), "..")
    parser.add_argument("--dataset-dir", default=os.path.join(root, "dataset"))
    parser.add_argument("--model-dir", default=os.path.join(root, "models"))
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--batch-size", type=int, default=32)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    train(args)
