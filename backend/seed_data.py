import os
import random
import time  # 引入时间模块，让程序可以“休息”
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

# 1. 环境变量与连接
load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

MERCHANT_ID = "c6417c1f-56ee-4f6a-bab8-def781d9418f"

def seed_database():
    print("🚀 开始注入销量数据 (抗网络波动版)...")

    # --- 第一步：读取刚才已经成功插入的菜品 ---
    print("🍔 正在从数据库获取已有的菜单数据...")
    res = supabase.table("menu_items").select("*").eq("merchant_id", MERCHANT_ID).execute()
    inserted_items = res.data
    
    if not inserted_items:
        print("❌ 找不到菜单数据，请先确保 menu_items 表里有数据！")
        return

    print(f"✅ 成功获取 {len(inserted_items)} 个菜品，准备生成销量！")

    # --- 第二步：按天分块插入销量日志，加入重试机制 ---
    print("📈 开始生成过去 7 天的销量数据...")
    today = datetime.now().date()
    total_inserted = 0
    
    for i in range(7):
        log_date = today - timedelta(days=i)
        daily_payload = []
        
        for item in inserted_items:
            qty = random.randint(5, 50)
            if log_date.weekday() >= 5: 
                qty += random.randint(10, 30)

            daily_payload.append({
                "merchant_id": MERCHANT_ID,
                "item_id": item["id"],
                "quantity_sold": qty,
                "log_date": str(log_date)
            })
            
        # 企业级操作：重试机制 (Try-Except with Retry)
        success = False
        retries = 3 # 如果失败，最多重试 3 次
        
        while not success and retries > 0:
            try:
                supabase.table("sales_logs").insert(daily_payload).execute()
                success = True
            except Exception as e:
                print(f"   ⚠️ 网络小波动，正在重试... (剩余重试次数: {retries-1})")
                time.sleep(2) # 报错了就休息 2 秒再试
                retries -= 1

        if success:
            total_inserted += len(daily_payload)
            print(f"   -> 成功插入 {log_date} 的 {len(daily_payload)} 条销量记录")
        else:
            print(f"   ❌ {log_date} 插入失败，跳过。")
            
        # 正常请求完后，强制程序休眠 1 秒，防止请求过快被服务器踢掉
        time.sleep(1) 

    print(f"✅ 成功插入了总共 {total_inserted} 条销量历史！")
    print("🎉 数据库弹药已装填完毕，可以给 AI 工程师使用了！")

if __name__ == "__main__":
    seed_database()