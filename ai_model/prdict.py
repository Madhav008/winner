import pandas as pd
import joblib
import numpy as np

# Load the trained model & encoders
model = joblib.load("xgboost_model.pkl")
label_encoders = joblib.load("label_encoders.pkl")
winner_encoder = joblib.load("winner_encoder.pkl")

# Manually enter match details for prediction
match_data = {
    "info.team": ["TeamA vs TeamB"],  # Modify with actual team names
    "info.toss.winner": ["TeamA"],  # Change based on toss outcome
    "info.city": ["Mumbai"],  # Change based on match location
    "info.venue": ["Wankhede Stadium"],  # Stadium name
    "info.dates": ["2025-03-02"],  # Match date
    "info.player_of_match": ["PlayerX"],  # Player of match (if known, else set to "-1")
    "info.toss.decision": ["bat"],  # bat/bowl
    "info.match_number": [1],  # Match number in tournament
    "info.home_ground": ["TeamA"],  # Home team (if applicable)
    "player.type": ["Batsman"],  # Player type (Batsman, Bowler, etc.)
}

# Convert to DataFrame
new_match_df = pd.DataFrame(match_data)

# Encode categorical features
for col in label_encoders:
    if col in new_match_df.columns:
        new_match_df[col] = new_match_df[col].astype(str)  # Ensure data is in string format
        new_match_df[col] = label_encoders[col].transform(new_match_df[col])

# Make prediction
predicted_winner_encoded = model.predict(new_match_df)
predicted_winner = winner_encoder.inverse_transform(predicted_winner_encoded)

# Output the predicted winner
print(f"🏆 Predicted Winner: {predicted_winner[0]}")
