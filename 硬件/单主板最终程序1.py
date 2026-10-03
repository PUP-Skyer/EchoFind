import network, urequests, ujson, time, gc
import machine
from machine import UART, Pin
from secrets import WIFI_SSID, WIFI_PASS

# ==================== 配置 ====================
UART_ID = 2
TX_PIN  = 17
RX_PIN  = 16
BAUD    = 115200
LED_PIN = 2

HEARTBEAT_PIN = 13
HEARTBEAT_MS  = 500

# ---- HTTP 参数 ----
HTTP_TIMEOUT_S        = 8       # 单次 socket 超时
HTTP_MAX_RETRIES      = 2
HTTP_RETRY_BASE       = 800
HTTP_CALL_GAP_MS      = 300
HTTP_TOTAL_TIMEOUT_MS = 15000   # 单次请求总超时（含重试）
MAX_OPS_PER_ROUND     = 2
# -------------------

# ---- 看门狗参数 ----
WDT_TIMEOUT_MS = 30000          # 硬件看门狗 30 秒
# -------------------

SCAN_INTERVAL_MS  = 500
FALLBACK_MS       = 1730000040000
UNIX_EPOCH_OFFSET = 946684800

RSSI_MIN_DBM = -85
MIN_HITS     = 2
DEBUG        = False
# ================================================

uart = UART(UART_ID, baudrate=BAUD, tx=Pin(TX_PIN), rx=Pin(RX_PIN),
            bits=8, parity=None, stop=1, timeout=20)
led  = Pin(LED_PIN, Pin.OUT)
heartbeat = Pin(HEARTBEAT_PIN, Pin.OUT)

ReadMulti = bytes([0xBB,0x00,0x27,0x00,0x03,0x22,0xFF,0xFF,0x4A,0x7E])

_token = None
_token_expire_at = 0

_total_frames = 0
_rssi_drops   = 0

_last_hb = 0
_hb_state = 0
_last_http_call = 0

pending_ops = []

_wdt = None


# ==================== 看门狗 ====================
def init_watchdog():
    global _wdt
    try:
        _wdt = machine.WDT(timeout=WDT_TIMEOUT_MS)
        print("[WDT] 硬件看门狗已启动 {} ms".format(WDT_TIMEOUT_MS))
    except Exception as e:
        _wdt = None
        print("[WDT] 初始化失败:", e)


def feed_watchdog():
    if _wdt:
        try:
            _wdt.feed()
        except Exception:
            pass


# ==================== 心跳 ====================
def heartbeat_tick():
    global _last_hb, _hb_state
    now = time.ticks_ms()
    if time.ticks_diff(now, _last_hb) >= HEARTBEAT_MS:
        _last_hb = now
        _hb_state = 0 if _hb_state else 1
        heartbeat.value(_hb_state)


def _wait_heartbeat(ms):
    end = time.ticks_add(time.ticks_ms(), ms)
    while time.ticks_diff(end, time.ticks_ms()) > 0:
        heartbeat_tick()
        feed_watchdog()      # 等待期间也喂狗
        time.sleep_ms(50)


# ==================== 内存守门 ====================
def ensure_memory(min_free=40000, test_alloc=8192):
    for _ in range(10):
        gc.collect()
        if gc.mem_free() < min_free:
            time.sleep_ms(80)
            continue
        try:
            b = bytearray(test_alloc)
            del b
            gc.collect()
            return True
        except MemoryError:
            time.sleep_ms(80)
            continue
    return False


# ==================== 通用 HTTP（含总超时看门狗） ====================
def http_call(method, url, body=None, headers=None,
              max_retries=HTTP_MAX_RETRIES,
              total_timeout_ms=HTTP_TOTAL_TIMEOUT_MS):
    global _last_http_call
    last_err = "未知错误"
    call_start = time.ticks_ms()

    for attempt in range(max_retries):
        # ---- 总超时检查 ----
        elapsed = time.ticks_diff(time.ticks_ms(), call_start)
        if elapsed > total_timeout_ms:
            print("  [总超时] 已耗时 {}ms > {}ms，放弃".format(
                elapsed, total_timeout_ms))
            return False, None
        # --------------------

        # 请求间强制间隔
        gap = time.ticks_diff(time.ticks_ms(), _last_http_call)
        if gap < HTTP_CALL_GAP_MS:
            _wait_heartbeat(HTTP_CALL_GAP_MS - gap)

        if not ensure_memory(40000, 8192):
            if DEBUG:
                print("  [跳过] 内存不足 free={}".format(gc.mem_free()))
            return False, None

        _last_http_call = time.ticks_ms()
        feed_watchdog()

        r = None
        txt = None
        try:
            if method == 'POST':
                try:
                    r = urequests.post(url, data=body, headers=headers,
                                       timeout=HTTP_TIMEOUT_S)
                except TypeError:
                    r = urequests.post(url, data=body, headers=headers)
            elif method == 'PUT':
                try:
                    r = urequests.put(url, data=body, headers=headers,
                                      timeout=HTTP_TIMEOUT_S)
                except TypeError:
                    r = urequests.put(url, data=body, headers=headers)
            elif method == 'GET':
                try:
                    r = urequests.get(url, headers=headers,
                                      timeout=HTTP_TIMEOUT_S)
                except TypeError:
                    r = urequests.get(url, headers=headers)
            else:
                return False, None

            txt = r.text
            try:
                r.close()
            except Exception:
                pass
            r = None
            gc.collect()
            feed_watchdog()

            try:
                data = ujson.loads(txt)
            except Exception:
                txt = None
                last_err = "响应非 JSON"
                if attempt < max_retries - 1:
                    _wait_heartbeat(HTTP_RETRY_BASE * (attempt + 1))
                    continue
                return False, None
            txt = None

            code = data.get("code")
            if code == 0:
                return True, data

            if code == 9499:
                if DEBUG:
                    print("  [放弃] 参数 9499")
                return False, data

            last_err = "code={}".format(code)
            if attempt < max_retries - 1:
                _wait_heartbeat(HTTP_RETRY_BASE * (attempt + 1))
            else:
                if DEBUG:
                    print("  [放弃] {}".format(last_err))
                return False, data

        except Exception as e:
            last_err = "{}".format(e)
            if r:
                try:
                    r.close()
                except Exception:
                    pass
                r = None
            txt = None
            gc.collect()

            # 异常后也检查总超时
            elapsed = time.ticks_diff(time.ticks_ms(), call_start)
            if elapsed > total_timeout_ms:
                print("  [总超时-异常] 已耗时 {}ms，放弃".format(elapsed))
                return False, None

            if attempt < max_retries - 1:
                if DEBUG:
                    print("  [重试 {}/{}] {}".format(
                        attempt + 1, max_retries, last_err))
                _wait_heartbeat(HTTP_RETRY_BASE * (attempt + 1))
            else:
                if DEBUG:
                    print("  [放弃] {}".format(last_err))
                return False, None

    return False, None


# ==================== 网络与时间 ====================
def connect_wifi():
    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    if not sta.isconnected():
        print("Connecting WiFi...")
        sta.connect(WIFI_SSID, WIFI_PASS)
        for _ in range(30):
            if sta.isconnected():
                break
            heartbeat_tick()
            feed_watchdog()          # 连 WiFi 时也喂狗
            time.sleep(0.1)
    ip = sta.ifconfig()[0]
    print("WiFi IP:", ip)
    return ip != "0.0.0.0"


def sync_ntp():
    try:
        import ntptime
    except ImportError:
        return False
    for host in ["ntp.aliyun.com", "ntp.tencent.com", "cn.pool.ntp.org"]:
        try:
            ntptime.host = host
            ntptime.settime()
            if time.time() > 700000000:
                print("NTP 成功:", host)
                return True
        except Exception:
            time.sleep(1)
    print("NTP 全部失败")
    return False


def now_ms():
    t = time.time()
    if t < 1000000000:
        t += UNIX_EPOCH_OFFSET
    if t < 1700000000:
        return FALLBACK_MS
    return int(t) // 60 * 60 * 1000


def rssi_to_strength(rssi_dbm):
    if rssi_dbm >= -40:
        return 100.0
    if rssi_dbm <= -100:
        return 0.0
    return round((rssi_dbm + 100) / 60.0 * 100.0, 2)


# ==================== 飞书底层 API ====================
def get_token():
    global _token, _token_expire_at
    now = time.ticks_ms()
    if _token and time.ticks_diff(_token_expire_at, now) > 5 * 60 * 1000:
        return _token

    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    body = ujson.dumps({"app_id": APP_ID, "app_secret": APP_SECRET}).encode()
    headers = {"Content-Type": "application/json"}

    ok, data = http_call('POST', url, body, headers)
    body = None
    headers = None
    gc.collect()

    if ok:
        _token = data["tenant_access_token"]
        _token_expire_at = time.ticks_add(now, data["expire"] * 1000)
        print("[Token 刷新]")
        return _token
    print("[Token 失败]")
    return None


def feishu_headers():
    token = get_token()
    if not token:
        return None
    return {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
    }


def _do_find_record(epc):
    url = ("https://open.feishu.cn/open-apis/bitable/v1/apps/"
           + APP_TOKEN + "/tables/" + TABLE_ID + "/records/search")
    payload = {
        "filter": {
            "conjunction": "and",
            "conditions": [{"field_name": "编号", "operator": "is", "value": [epc]}]
        }
    }
    body = ujson.dumps(payload).encode()
    payload = None

    headers = feishu_headers()
    if not headers:
        body = None
        return None

    ok, data = http_call('POST', url, body, headers)
    body = None
    headers = None
    gc.collect()

    if ok:
        items = data["data"].get("items", [])
        rid = items[0]["record_id"] if items else None
        data = None
        gc.collect()
        return rid
    return None


def _do_create_record(epc, strength, ts, stored):
    url = ("https://open.feishu.cn/open-apis/bitable/v1/apps/"
           + APP_TOKEN + "/tables/" + TABLE_ID + "/records")
    fields = {
        "编号": epc,
        "强度": strength,
        "时间": ts,
        "是否存入": 1 if stored else 0,
    }
    body = ujson.dumps({"fields": fields}).encode()
    fields = None

    headers = feishu_headers()
    if not headers:
        body = None
        return None

    ok, data = http_call('POST', url, body, headers)
    body = None
    headers = None
    gc.collect()

    if ok:
        rid = data["data"]["record"]["record_id"]
        data = None
        gc.collect()
        return rid
    return None


def _do_update_record(rid, strength, ts, stored):
    if not rid:
        return False
    url = ("https://open.feishu.cn/open-apis/bitable/v1/apps/"
           + APP_TOKEN + "/tables/" + TABLE_ID + "/records/" + rid)
    fields = {
        "强度": strength,
        "时间": ts,
        "是否存入": 1 if stored else 0,
    }
    body = ujson.dumps({"fields": fields}).encode()
    fields = None

    headers = feishu_headers()
    if not headers:
        body = None
        return False

    ok, data = http_call('PUT', url, body, headers)
    body = None
    headers = None
    data = None
    gc.collect()
    return ok


# ==================== 队列 ====================
def push_op(action, **kwargs):
    if len(pending_ops) > 30:
        print("  [丢弃] 队列积压过多")
        return
    pending_ops.append((action, kwargs))


card_state_global = {}


def process_pending(max_ops=MAX_OPS_PER_ROUND):
    global _token
    done = 0
    while pending_ops and done < max_ops:
        action, kwargs = pending_ops.pop(0)
        feed_watchdog()
        try:
            if action == 'query_then_upsert':
                epc = kwargs['epc']
                strength = kwargs['strength']
                ts = kwargs['ts']
                rid = _do_find_record(epc)
                if rid:
                    print("  [队列] 已有记录 {}，更新".format(epc))
                    _do_update_record(rid, strength, ts, True)
                    if epc in card_state_global:
                        card_state_global[epc]["record_id"] = rid
                else:
                    print("  [队列] 新卡 {}，创建".format(epc))
                    rid = _do_create_record(epc, strength, ts, True)
                    if rid and epc in card_state_global:
                        card_state_global[epc]["record_id"] = rid
                done += 1

            elif action == 'update':
                _do_update_record(**kwargs)
                done += 1

        except Exception as e:
            print("  [队列异常] {}".format(e))
            done += 1
    return done


# ==================== UART 帧解析 ====================
def parse_frames(buf, readings):
    global _total_frames, _rssi_drops

    while True:
        if len(buf) < 5:
            return
        idx = -1
        for i in range(len(buf)):
            if buf[i] == 0xBB:
                idx = i
                break
        if idx < 0:
            buf.clear()
            return
        if idx > 0:
            del buf[:idx]

        if len(buf) < 5:
            return
        if buf[1] != 0x02 or buf[2] != 0x22:
            del buf[0]
            continue

        dlen = (buf[3] << 8) | buf[4]
        frame_len = 5 + dlen + 1 + 1
        if len(buf) < frame_len:
            return

        frame = bytes(buf[:frame_len])
        if frame[frame_len - 1] != 0x7E:
            del buf[0]
            continue

        del buf[:frame_len]
        _total_frames += 1

        rssi_raw = frame[5]
        rssi_dbm = rssi_raw - 256 if rssi_raw > 127 else rssi_raw
        if rssi_dbm < RSSI_MIN_DBM:
            _rssi_drops += 1
            continue

        epc_bytes = frame[8:20]
        epc_str = "".join("{:02X}".format(b) for b in epc_bytes)
        readings.append((epc_str, rssi_dbm))


# ==================== 主循环 ====================
def main():
    global _total_frames, _rssi_drops, card_state_global

    gc.collect()
    gc.threshold(gc.mem_free() // 4 + gc.mem_alloc())
    print("启动内存: free={} used={}".format(gc.mem_free(), gc.mem_alloc()))

    # === 启动看门狗（越早越好） ===
    init_watchdog()

    for _ in range(3):
        heartbeat.value(1)
        time.sleep_ms(100)
        heartbeat.value(0)
        time.sleep_ms(100)
        feed_watchdog()

    if not connect_wifi():
        print("WiFi 连接失败，继续运行")
    feed_watchdog()

    sync_ntp()
    feed_watchdog()
    print("校准后 now_ms() =", now_ms())

    if not get_token():
        print("Token 获取失败，继续运行")
    feed_watchdog()

    card_state = {}
    card_state_global = card_state
    buf = []
    round_count = 0

    print("\n===== 每 {} ms 扫描一轮，每轮最多 {} 个飞书操作 ====="
          .format(SCAN_INTERVAL_MS, MAX_OPS_PER_ROUND))
    print("HTTP 总超时 {}ms | WDT 超时 {}ms"
          .format(HTTP_TOTAL_TIMEOUT_MS, WDT_TIMEOUT_MS))

    last_scan = time.ticks_ms()

    while True:
        heartbeat_tick()
        feed_watchdog()          # 主循环每圈都喂

        now = time.ticks_ms()

        if gc.mem_free() < 12000:
            print("[严重] 内存枯竭 {}，硬复位".format(gc.mem_free()))
            time.sleep_ms(500)
            machine.reset()

        if time.ticks_diff(now, last_scan) >= SCAN_INTERVAL_MS:
            last_scan = now
            round_count += 1

            # ---- 1. 读卡 ----
            buf.clear()
            _total_frames = 0
            _rssi_drops = 0

            led.value(1)
            uart.write(ReadMulti)
            time.sleep_ms(50)
            led.value(0)

            readings = []
            wait_until = time.ticks_add(time.ticks_ms(), 1500)
            while time.ticks_diff(wait_until, time.ticks_ms()) > 0:
                heartbeat_tick()
                feed_watchdog()
                chunk = uart.read()
                if chunk:
                    buf.extend(chunk)
                    parse_frames(buf, readings)
                time.sleep_ms(20)

            # ---- 2. 多帧表决 ----
            hits = {}
            for epc, rssi_dbm in readings:
                if epc not in hits:
                    hits[epc] = {"count": 0, "rssi": rssi_dbm}
                hits[epc]["count"] += 1
                hits[epc]["rssi"] = rssi_dbm

            valid = {}
            for epc, v in hits.items():
                if v["count"] >= MIN_HITS:
                    valid[epc] = v["rssi"]

            readings = None
            hits = None
            gc.collect()

            ts = now_ms()

            # ---- 3. 处理进入/离开 ----
            for epc, rssi_dbm in valid.items():
                strength = rssi_to_strength(rssi_dbm)

                if epc not in card_state:
                    print("[进入] {}".format(epc))
                    push_op('query_then_upsert',
                            epc=epc, strength=strength, ts=ts)
                    card_state[epc] = {"rssi": rssi_dbm,
                                       "record_id": None,
                                       "stored": True}
                else:
                    st = card_state[epc]
                    if not st["stored"]:
                        print("[重新进入] {}".format(epc))
                        if st["record_id"]:
                            push_op('update',
                                    rid=st["record_id"],
                                    strength=strength, ts=ts, stored=True)
                        else:
                            push_op('query_then_upsert',
                                    epc=epc, strength=strength, ts=ts)
                        st["stored"] = True
                    st["rssi"] = rssi_dbm

            for epc, st in card_state.items():
                if epc not in valid and st["stored"]:
                    print("[离开] {}".format(epc))
                    if st["record_id"]:
                        push_op('update',
                                rid=st["record_id"],
                                strength=rssi_to_strength(st["rssi"]),
                                ts=ts, stored=False)
                    st["stored"] = False

            valid = None
            gc.collect()

            # ---- 4. 执行队列 ----
            done = process_pending(MAX_OPS_PER_ROUND)

            print("[第 {} 轮] 队列 {} | 本轮执行 {} | free={}"
                  .format(round_count, len(pending_ops), done,
                          gc.mem_free()))

            ts = None
            gc.collect()
            feed_watchdog()      # 一轮结束时喂狗

        time.sleep_ms(10)


main()
