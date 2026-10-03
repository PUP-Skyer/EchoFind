import network, urequests, ujson, time, gc
from secrets import WIFI_SSID, WIFI_PASS

# ===== 写死的测试数据 =====
TEST_DATA = {
    "编号": "T001",
    "物品名称": "测试物品",
    "强度": 0.75,
    "是否存入": 1,  # 这个复选框字段只接受数字 1/0，不能传 True/False
}
# "物品图片"字段需要先上传文件拿到 file_token 才能填，测试阶段留空

# 写死的时间戳：2026-10-02（毫秒），NTP 对时成功后会用真实时间
FALLBACK_MS = 1790899200000


def connect():
    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    if not sta.isconnected():
        sta.connect(WIFI_SSID, WIFI_PASS)
        for _ in range(20):
            if sta.isconnected():
                break
            time.sleep(1)
    print("IP:", sta.ifconfig()[0])


def get_token():
    gc.collect()
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    body = '{"app_id":"' + APP_ID + '","app_secret":"' + APP_SECRET + '"}'
    r = urequests.post(url, data=body.encode(),
                       headers={"Content-Type": "application/json"})
    t = r.text
    r.close()
    gc.collect()
    return ujson.loads(t)["tenant_access_token"]


def now_ms():
    # NTP 对时，成功后 time.time() 是 Unix 秒；失败则用写死的时间
    try:
        import ntptime
        ntptime.settime()
        return int(time.time() * 1000)
    except Exception as e:
        print("[时间] NTP 失败，用写死时间:", e)
        return FALLBACK_MS


def create_record(token):
    gc.collect()
    url = ("https://open.feishu.cn/open-apis/bitable/v1/apps/"
           + APP_TOKEN + "/tables/" + TABLE_ID + "/records")

    fields = dict(TEST_DATA)
    fields["时间"] = now_ms()

    # 必须 .encode() 成 bytes 再发：urequests 对 str 按"字符数"算 Content-Length，
    # 中文会让长度偏小、JSON 被截断，飞书报 9499
    body = ujson.dumps({"fields": fields}).encode()
    print("\n[新建] Body:", body)

    r = urequests.post(url, data=body, headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    })
    txt = r.text
    r.close()
    gc.collect()
    print("[新建] Raw:", txt)
    return txt


# ========== 主流程 ==========
connect()
tk = get_token()
print("Token OK")

create_record(tk)

print("\n===== 完成 =====")
