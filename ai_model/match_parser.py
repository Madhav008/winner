import json
import pandas as pd
import os
from glob import glob

def extract_required_data(json_file):
    with open(json_file, "r", encoding="utf-8") as file:
        data = json.load(file)
    
    extracted_data = []
    teams = data.get("info", {}).get("teams", [])
    city = data.get("info", {}).get("city", "")
    winner = data.get("info", {}).get("outcome", {}).get("winner", "")
    
    # Initialize player stats dictionary
    player_stats = {}
    
    for inning in data.get("innings", []):
        for over in inning.get("overs", []):
            bowler_in_over = set()
            for delivery in over.get("deliveries", []):
                batter = delivery.get("batter", "")
                bowler = delivery.get("bowler", "")
                non_striker = delivery.get("non_striker", "")
                batter_runs = delivery.get("runs", {}).get("batter", 0)
                extras = delivery.get("runs", {}).get("extras", 0)
                
                # Ensure all players have default stats initialized
                if batter not in player_stats:
                    player_stats[batter] = {"runs": 0, "balls": 0, "extras": 0, "wickets": 0, "overs": 0, "type": "Batsman"}
                if bowler not in player_stats:
                    player_stats[bowler] = {"runs": 0, "balls": 0, "extras": 0, "wickets": 0, "overs": 0, "type": "Bowler"}
                
                # Update batter stats
                player_stats[batter]["runs"] += batter_runs
                player_stats[batter]["balls"] += 1
                
                # Update bowler stats for extras and overs
                player_stats[bowler]["extras"] += extras
                
                # Count wickets taken by bowler
                if "wickets" in delivery:
                    for wicket in delivery["wickets"]:
                        if wicket.get("player_out", ""):
                            player_stats[bowler]["wickets"] += 1
                
                # Track overs bowled
                if bowler not in bowler_in_over:
                    bowler_in_over.add(bowler)
                    player_stats[bowler]["overs"] += 1
    
    # Calculate additional performance metrics
    for player, stats in player_stats.items():
        # Strike Rate (SR) = (Runs / Balls) * 100
        stats["strike_rate"] = round((stats["runs"] / stats["balls"]) * 100, 2) if stats["balls"] > 0 else 0
        
        # Economy Rate = (Runs Conceded / Overs Bowled)
        stats["economy"] = round(stats["runs"] / stats["overs"], 2) if stats["overs"] > 0 else 0
        
        # Bowling Average = Runs Conceded / Wickets (if wickets taken)
        stats["bowling_avg"] = round(stats["runs"] / stats["wickets"], 2) if stats["wickets"] > 0 else 0
        
        # Determine player type (Batsman, Bowler, All-Rounder)
        if stats.get("overs", 0) > 0 and stats.get("runs", 0) > 0:
            stats["type"] = "All-Rounder"
        elif stats.get("overs", 0) > 0:
            stats["type"] = "Bowler"
        elif stats.get("runs", 0) > 0:
            stats["type"] = "Batsman"
    
    # Process teams and players
    for team in teams:
        players = data.get("info", {}).get("players", {}).get(team, [])
        home_ground = 1 if city in team else 0
        home_team_win = 1 if team == winner else 0
        
        for player in players:
            row = {
                "info.city": city,
                "info.dates": ", ".join(data.get("info", {}).get("dates", [])),
                "info.match_number": data.get("info", {}).get("event", {}).get("match_number", ""),
                "info.event_name": data.get("info", {}).get("event", {}).get("name", ""),
                "info.match_type": data.get("info", {}).get("match_type", ""),
                "info.outcome.by.runs": data.get("info", {}).get("outcome", {}).get("by", {}).get("runs", ""),
                "info.outcome.winner": winner,
                "info.overs": data.get("info", {}).get("overs", ""),
                "info.player_of_match": ", ".join(data.get("info", {}).get("player_of_match", [])),
                "info.team": team,
                "info.player": player,
                "info.toss.decision": data.get("info", {}).get("toss", {}).get("decision", ""),
                "info.toss.winner": data.get("info", {}).get("toss", {}).get("winner", ""),
                "info.venue": data.get("info", {}).get("venue", ""),
                "info.home_ground": home_ground,
                "info.home_team_win": home_team_win,
                "player.runs": player_stats.get(player, {}).get("runs", 0),
                "player.balls": player_stats.get(player, {}).get("balls", 0),
                "player.extras": player_stats.get(player, {}).get("extras", 0),
                "player.wickets": player_stats.get(player, {}).get("wickets", 0),
                "player.overs": player_stats.get(player, {}).get("overs", 0),
                "player.strike_rate": player_stats.get(player, {}).get("strike_rate", 0),
                "player.economy": player_stats.get(player, {}).get("economy", 0),
                "player.bowling_avg": player_stats.get(player, {}).get("bowling_avg", 0),
                "player.type": player_stats.get(player, {}).get("type", "")
            }
            extracted_data.append(row)
    
    return extracted_data

def process_all_json_files(json_folder="ipl_json"):
    all_data = []
    
    # Get all JSON files from the directory
    json_files = glob(os.path.join(json_folder, "*.json"))
    
    print(f"Processing {len(json_files)} JSON files...")

    for json_file in json_files:
        match_data = extract_required_data(json_file)
        all_data.extend(match_data)

    return all_data

def save_to_csv(data, output_file="ipl_player_performance.csv"):
    df = pd.DataFrame(data)
    df.to_csv(output_file, index=False)
    print(f"✅ CSV file saved: {output_file}")

# Process all JSON files and save
all_match_data = process_all_json_files()
save_to_csv(all_match_data)
