import pandas as pd
import joblib
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score

# Load the dataset
df = pd.read_csv("ipl_player_performance.csv")

# Drop unnecessary and leakage-prone columns
drop_cols = [
    "info.outcome.by.runs",  # Directly reveals match outcome
    "info.home_team_win",  # Reveals winner directly
    "player.runs", "player.balls", "player.extras", "player.wickets",  # Performance stats
    "player.overs", "player.strike_rate", "player.economy", "player.bowling_avg",  # More stats
]
df = df.drop(columns=drop_cols, errors="ignore")

# Handle missing values
df.fillna("-1", inplace=True)  # Convert NaN values to a safe string

# Encode categorical features
label_encoders = {}
categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

for col in categorical_cols:
    df[col] = df[col].astype(str)  # Ensure all values are strings
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col])
    label_encoders[col] = le  # Store encoder for later use

# Define features & target variable
X = df.drop(columns=["info.outcome.winner"], errors="ignore")  # Features
y = df["info.outcome.winner"]  # Target (Match winner)

# Encode target variable
le_winner = LabelEncoder()
y = le_winner.fit_transform(y)

# Ensure splitting by match number (to avoid data leakage)
gss = GroupShuffleSplit(n_splits=1, test_size=0.3, random_state=42)  # Increased test size
groups = df["info.match_number"]

for train_idx, test_idx in gss.split(X, y, groups):
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

# Check for duplicate rows between train & test
duplicates = X_train.merge(X_test, how='inner')
print(f"❗ Number of duplicate rows in train & test: {len(duplicates)}")

# Train XGBoost Model with Regularization
model = XGBClassifier(
    n_estimators=300,  # More trees for better learning
    learning_rate=0.05,  # Reduce overfitting
    max_depth=5,  # Prevent memorization
    colsample_bytree=0.8,  # Use only 80% of features per tree
    reg_lambda=10,  # L2 Regularization
    random_state=42
)

model.fit(X_train, y_train)

# Model Evaluation
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"✅ Model Accuracy: {accuracy:.4f}")

# Check train & test accuracy
print(f"✅ Training Accuracy: {model.score(X_train, y_train)}")
print(f"✅ Testing Accuracy: {model.score(X_test, y_test)}")

# Check class distribution in training set
print("Target Variable Distribution in Training Set:")
print(pd.Series(y_train).value_counts())

# Save Model & Encoders
joblib.dump(model, "xgboost_model.pkl")
joblib.dump(label_encoders, "label_encoders.pkl")
joblib.dump(le_winner, "winner_encoder.pkl")
print("✅ Model & Encoders Saved Successfully!")

# 📊 Feature Importance Plot
feature_importance = np.array(model.feature_importances_)
important_features = np.argsort(feature_importance)[::-1][:10]  # Get top 10 features

print("🛠️ Top 10 Most Important Features:")
for i in important_features:
    print(f"{X.columns[i]}: {feature_importance[i]}")

# Plot feature importance
# plt.figure(figsize=(10, 5))
# sns.barplot(x=model.feature_importances_, y=X.columns, palette="viridis")
# plt.title("Feature Importance (XGBoost)")
# plt.xlabel("Importance Score")
# plt.ylabel("Features")
# plt.show()

