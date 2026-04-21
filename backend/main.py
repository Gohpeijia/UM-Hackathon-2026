import os
import csv
import io
import requests
import pandas as pd
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import BackgroundTasks

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Specifically allow your React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# connect Supabase
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def check_and_notify_costs(merchant_id: str):
    now = datetime.now()
    current_year, current_month = now.year, now.month
    
    try:
        response = supabase.table("monthly_overheads") \
            .select("*") \
            .eq("merchant_id", merchant_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
            
        records = response.data
        needs_update = True
        
        if len(records) > 0:
            last_record = records[0]
            last_date = datetime.fromisoformat(last_record["created_at"].split(".")[0])
            if last_date.year == current_year and last_date.month == current_month:
                needs_update = False
                
        if needs_update:
            print(f"⚠️ [Background Task] Merchant {merchant_id} hasn't updated costs for {current_month}!")
            print(f"🔔 [Simulated Notification] Sent to Boss: Please update this month's rent and utilities!")
        else:
            print(f"✅ [Background Task] Merchant {merchant_id}'s costs are up to date.")
    except Exception as e:
        print(f"Background task error: {e}")


@app.get("/")
def read_root():
    return {"message": "MicroEdge Backend 运行中!"}

# feature: save the AI analysis cost 
@app.post("/add-ingredient")
async def add_ingredient(name: str, price: float, m_id: str):
    data = {"merchant_id": m_id, "item_name": name, "price_per_unit": price}
    response = supabase.table("ingredient_costs").insert(data).execute()
    return {"status": "success", "data": response.data}

@app.post("/add-menu-item")
async def add_menu_item(merchant_id: str, item_name: str, original_price: float):

    data = {
        "merchant_id": merchant_id,
        "item_name": item_name,
        "original_price": original_price,
        "is_active": True 
    }
    
    try:
        response = supabase.table("menu_items").insert(data).execute()
        return {
            "status": "success", 
            "message": f"Successfully added dish: {item_name} (RM {original_price})", 
            "data": response.data
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/upload-sales-logs-csv")
async def upload_sales_logs_csv(merchant_id: str = Form(...), file: UploadFile = File(...)):
    if not merchant_id.strip():
        raise HTTPException(status_code=400, detail="merchant_id is required")

    if not file.filename:
        raise HTTPException(status_code=400, detail="CSV file is required")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        csv_text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(csv_text))
    required_columns = ["order_id", "date", "time", "item_name", "quantity", "unit_price"]

    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV header row is missing")

    normalized_headers = [h.strip() if isinstance(h, str) else h for h in reader.fieldnames]
    missing_columns = [col for col in required_columns if col not in normalized_headers]
    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required CSV columns: {', '.join(missing_columns)}",
        )

    valid_rows = []
    invalid_rows = []
    seen_in_file = set()
    duplicate_in_file_count = 0

    for row_index, row in enumerate(reader, start=2):
        row = {(k.strip() if isinstance(k, str) else k): v for k, v in row.items()}

        if not any((value or "").strip() for value in row.values() if isinstance(value, str)):
            continue

        try:
            order_id_raw = (row.get("order_id") or "").strip()
            order_id = order_id_raw if order_id_raw else None

            date_raw = (row.get("date") or "").strip()
            log_date = datetime.strptime(date_raw, "%d/%m/%Y").date().isoformat()

            time_raw = (row.get("time") or "").strip()
            try:
                log_time = datetime.strptime(time_raw, "%H:%M").time().strftime("%H:%M:%S")
            except ValueError:
                log_time = datetime.strptime(time_raw, "%H:%M:%S").time().strftime("%H:%M:%S")

            item_name = (row.get("item_name") or "").strip()
            if not item_name:
                raise ValueError("item_name is required")

            quantity_raw = (row.get("quantity") or "").strip()
            quantity = int(quantity_raw)
            if quantity < 0:
                raise ValueError("quantity must be >= 0")

            unit_price_raw = (row.get("unit_price") or "").strip()
            unit_price = Decimal(unit_price_raw).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            dedupe_key = (
                merchant_id,
                order_id or "",
                log_date,
                log_time,
                item_name,
                quantity,
                str(unit_price),
            )
            if dedupe_key in seen_in_file:
                duplicate_in_file_count += 1
                continue
            seen_in_file.add(dedupe_key)

            valid_rows.append(
                {
                    "merchant_id": merchant_id,
                    "order_id": order_id,
                    "log_date": log_date,
                    "log_time": log_time,
                    "item_name": item_name,
                    "quantity": quantity,
                    "unit_price": float(unit_price),
                }
            )

        except (ValueError, InvalidOperation) as exc:
            invalid_rows.append({"line": row_index, "reason": str(exc)})

    if not valid_rows:
        return {
            "success": False,
            "message": "No valid rows to insert",
            "inserted_rows": 0,
            "invalid_rows": len(invalid_rows),
            "duplicate_rows_in_file": duplicate_in_file_count,
            "errors": invalid_rows[:20],
        }

    min_date = min(r["log_date"] for r in valid_rows)
    max_date = max(r["log_date"] for r in valid_rows)

    existing_result = (
        supabase.table("sales_logs")
        .select("order_id, log_date, log_time, item_name, quantity, unit_price")
        .eq("merchant_id", merchant_id)
        .gte("log_date", min_date)
        .lte("log_date", max_date)
        .execute()
    )
    existing_rows = existing_result.data or []

    existing_keys = set()
    for existing in existing_rows:
        existing_keys.add(
            (
                merchant_id,
                (existing.get("order_id") or ""),
                str(existing.get("log_date") or ""),
                str(existing.get("log_time") or ""),
                str(existing.get("item_name") or ""),
                int(existing.get("quantity") or 0),
                str(Decimal(str(existing.get("unit_price") or 0)).quantize(Decimal("0.01"))),
            )
        )

    rows_to_insert = []
    duplicate_existing_count = 0
    for row in valid_rows:
        row_key = (
            merchant_id,
            row.get("order_id") or "",
            row["log_date"],
            row["log_time"],
            row["item_name"],
            int(row["quantity"]),
            str(Decimal(str(row["unit_price"])).quantize(Decimal("0.01"))),
        )
        if row_key in existing_keys:
            duplicate_existing_count += 1
            continue
        rows_to_insert.append(row)

    inserted_rows = 0
    if rows_to_insert:
        batch_size = 500
        for start in range(0, len(rows_to_insert), batch_size):
            batch = rows_to_insert[start : start + batch_size]
            supabase.table("sales_logs").insert(batch).execute()
            inserted_rows += len(batch)

    return {
        "success": True,
        "message": "CSV processed",
        "total_rows_read": len(valid_rows) + len(invalid_rows) + duplicate_in_file_count,
        "valid_rows": len(valid_rows),
        "inserted_rows": inserted_rows,
        "duplicate_rows_in_file": duplicate_in_file_count,
        "duplicate_rows_existing": duplicate_existing_count,
        "invalid_rows": len(invalid_rows),
        "errors": invalid_rows[:20],
    }


@app.get("/analyze-surroundings/{merchant_id}")
async def analyze_surroundings(merchant_id: str, lat: float, lon: float):

    # It uses the latitude and longitude to find schools within a 500m radius.
    schools = get_nearby_schools(lat, lon)

    # 2. Logic to generate a summary message
    # We check if the 'schools' list contains any data.
    if schools:
        # If schools are found, we create a friendly message for the merchant.
        # It mentions how many were found and the name of the closest one.
        message = f"Found {len(schools)} schools nearby: {schools[0]['name']} etc."
    else:
        # If the list is empty, we inform the merchant that no major schools were detected.
        message = "No major schools found nearby."

    # 3. The Response
    # This returns a JSON object back to the requester (the mobile app or the AI agent).
    # It includes the specific ID, the raw data, and our generated summary note.
    return {"merchant_id": merchant_id, "school_context": schools, "note": message}
    

def analyze_sales_trends(merchant_id: str) -> list:
    # 1. Fetch raw data from Supabase (fetching last 7 days for this Hackathon demo)
    response = supabase.table("sales_logs") \
        .select("quantity_sold, log_date, menu_items(item_name)") \
        .eq("merchant_id", merchant_id) \
        .order("log_date", desc=True) \
        .execute()
    
    raw_data = response.data
    
    if not raw_data:
        return ["No data available for analysis."]

    # 2. Flatten the data for Pandas DataFrame
    # Supabase returns nested JSON, we need to extract 'item_name' cleanly
    flat_data = []
    for row in raw_data:
        flat_data.append({
            "date": row["log_date"],
            "item_name": row["menu_items"]["item_name"],
            "quantity": row["quantity_sold"]
        })

    # 3. Load data into a Pandas DataFrame and convert string dates to Datetime objects
    df = pd.DataFrame(flat_data)
    df['date'] = pd.to_datetime(df['date'])

    # 4. Define Time Periods
    # For this Hackathon demo (since we only seeded 7 days of data), 
    # we will compare "Recent 3 Days" vs "Previous 3 Days".
    # Note: In production, change 'days=3' to 'days=7' for WoW (Week-over-Week) 
    # or 'days=30' for MoM (Month-over-Month).
    today = datetime.now()
    period_end = today
    period_mid = today - timedelta(days=3)
    period_start = today - timedelta(days=6)

    # 5. Split DataFrame into two timeframes
    recent_df = df[(df['date'] > period_mid) & (df['date'] <= period_end)]
    previous_df = df[(df['date'] > period_start) & (df['date'] <= period_mid)]

    # 6. Group by item_name and sum the quantities
    recent_agg = recent_df.groupby('item_name')['quantity'].sum()
    previous_agg = previous_df.groupby('item_name')['quantity'].sum()

    # 7. Calculate Percentage Change and generate AI insights
    insights = []
    for item in recent_agg.index:
        recent_qty = recent_agg[item]
        prev_qty = previous_agg.get(item, 0) # Use 0 if item wasn't sold previously
        
        if prev_qty > 0:
            # Formula: ((New - Old) / Old) * 100
            change_pct = ((recent_qty - prev_qty) / prev_qty) * 100
            
            # 8. Filter for significant changes (e.g., more than 20% drop or spike)
            if change_pct <= -20:
                insights.append(f"CRITICAL DROP: {item} sales dropped by {abs(change_pct):.0f}% compared to the previous period.")
            elif change_pct >= 20:
                insights.append(f"SPIKE: {item} sales increased by {change_pct:.0f}%. Keep it up!")

    # If everything is stable (between -20% and 20%)
    if not insights:
        return ["All sales are relatively stable. No drastic fluctuations detected."]
    
    return insights

@app.get("/get-ai-decision-package/{merchant_id}")
async def get_package(merchant_id: str, address: str, background_tasks: BackgroundTasks):
    
    background_tasks.add_task(check_and_notify_costs, merchant_id)
    
    lat, lon = get_coordinates(address)
    if lat is None:
        return {"error": "Invalid address"}

    weather = get_weather_context(lat, lon)
    traffic = get_traffic_context(lat, lon)
    schools = get_nearby_schools(lat, lon)
    
    sales_insights = analyze_sales_trends(merchant_id)

    menu_res = supabase.table("menu_items") \
        .select("id, item_name, original_price") \
        .eq("merchant_id", merchant_id) \
        .eq("is_active", True) \
        .execute()
    menu_data = menu_res.data

# Retrieve Sales History for the Last 7 Days
# We linked the menu_items table so that the AI ​​can directly see the dish name instead of the ID.
    sales_res = supabase.table("sales_logs") \
        .select("quantity_sold, log_date, menu_items(item_name)") \
        .eq("merchant_id", merchant_id) \
        .order("log_date", desc=True) \
        .limit(70) \
        .execute()
    sales_history = sales_res.data

    context_package = {
        "merchant_id": merchant_id,
        "timestamp": datetime.now().isoformat(),
        "environmental_context": {
            "weather": weather,
            "traffic": traffic,
            "nearby_schools": schools
        },
        "business_context": {
            "menu": menu_data,
            "trend_analysis": sales_insights
        }
    }
    return context_package


# Places API (New)
def get_nearby_schools(lat, lon, radius=500):
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    url = "https://places.googleapis.com/v1/places:searchNearby"
    
    # Google requires a FieldMask to specify which data fields to return
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.types"
    }

    # Define the search criteria
    payload = {
        "includedTypes": ["school"], # Filter results to only include schools
        "maxResultCount": 5,        # Limit to the nearest 5 locations
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lon},
                "radius": radius # Search radius in meters
            }
        }
    }

    try:
        # Send the POST request to Google's server
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        # Extract specific details from the JSON response
        schools = []
        if "places" in data:
            for place in data["places"]:
                schools.append({
                    "name": place["displayName"]["text"],
                    "address": place.get("formattedAddress", "No address")
                })
        return schools
    except Exception as e:
        print(f"Places API Error: {e}")
        return []

#use Geocoding API
#This is the foundation of all the functions. Cannot just give the AI ​​"Jalan University"; you need to convert it to latitude and longitude (lat/lon) so that can access the functions for weather, traffic conditions, and searching for schools.
def get_coordinates(address):
    # Use your Google Maps API Key
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={address}&key={api_key}"
    
    try:
        response = requests.get(url)
        data = response.json()
        if data["status"] == "OK":
            # Extract latitude and longitude
            location = data["results"][0]["geometry"]["location"]
            return location["lat"], location["lng"]
        return None, None
    except Exception as e:
        print(f"Geocoding Error: {e}")
        return None, None
    
#use Routes API for detect road situations
#By comparing "normal time" and "traffic prediction time," AI can determine whether current road conditions are severely impacting business.
def get_traffic_context(origin_lat, origin_lon):
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        # Requesting duration with and without traffic for comparison
        "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.condition"
    }
    
    # We simulate a short trip to measure local traffic density
    payload = {
        "origin": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lon}}},
        "destination": {"location": {"latLng": {"latitude": origin_lat + 0.01, "longitude": origin_lon + 0.01}}},
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE" # This is key for real-time traffic
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        # Logic: If duration > staticDuration, it means there is traffic
        duration = int(data["routes"][0]["duration"][:-1]) # Remove 's'
        static_duration = int(data["routes"][0]["staticDuration"][:-1])
        
        delay = duration - static_duration
        status = "Heavy Traffic" if delay > 300 else "Clear" # More than 5 mins delay
        
        return {"status": status, "delay_seconds": delay}
    except:
        return {"status": "Normal", "delay_seconds": 0}
    
# use Maps Grounding Lite for detect day festivals
def get_event_grounding(merchant_location, user_query):
    # Your friend (AI Engineer) will use this data to ground the GLM [cite: 39]
    # You provide the context; the model queries the Map database
    grounding_prompt = f"Based on the location {merchant_location}, are there any festivals or road closures like 'Pasar Ramadhan' today?"
    
    # The Backend passes this intent to the AI Module
    return {"instruction": "Query Google Maps for local events", "location": merchant_location}

#OpenWeather API for see weather use google geocoding API to get place and then this API will detect the weather
def get_weather_context(lat, lon):
    # Fetch the API key from environment variables
    api_key = os.getenv("OPENWEATHER_API_KEY")
    
    # Construct the API URL (units=metric ensures Celsius)
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
    
    try:
        # Send a GET request to OpenWeatherMap
        response = requests.get(url)
        data = response.json()
        
        # Check if the request was successful (HTTP 200)
        if response.status_code == 200:
            # Extract key weather information for the AI agent
            weather_data = {
                "main_condition": data['weather'][0]['main'], # e.g., 'Rain', 'Clouds', 'Clear'
                "description": data['weather'][0]['description'], # e.g., 'moderate rain'
                "temperature": data['main']['temp'], # Temperature in Celsius
                "humidity": data['main']['humidity'] # Humidity percentage
            }
            return weather_data
        else:
            print(f"Weather API Error: {data.get('message')}")
            return None
    except Exception as e:
        print(f"Connection Error: {e}")
        return None
    