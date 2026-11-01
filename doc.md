# Instagram Extension: API และแนวทางขยายฟีเจอร์

วันที่ค้นคว้า: 1 พฤศจิกายน 2026

เอกสารสำหรับวางแผนพัฒนา IG-Imbalance: ผู้ใช้ต้องเปิด Instagram และล็อกอินก่อนใช้งาน ครอบคลุมยอด/รายชื่อ followers–following, Story, รูป วิดีโอ Reels และโพสต์เป้าหมาย

**สถานะหลักฐาน:** ข้อกำหนด Extension ตรวจจากเอกสาร Chrome; ความสามารถ API ทางการตรวจจาก Meta collection บน Postman ส่วน internal endpoint ตรวจจากซอร์สในโปรเจกต์ ไม่ได้ทดสอบกับบัญชีหรือ session จริง จึงเป็นรายการสำหรับตรวจยืนยัน ไม่ใช่ API contract ที่รับประกันว่าใช้ได้ทุกบัญชี ทุกเวลา

## 1. เลือกช่องทางให้ตรงงาน

| ช่องทาง | เหมาะกับ | เงื่อนไข/ข้อจำกัด |
| --- | --- | --- |
| ข้อมูลที่หน้าเว็บโหลดแล้ว | ยอดหน้า profile, preview รูป/โพสต์/Story | ลด request; DOM อาจแสดงยอดย่อ; page state ภายในเปลี่ยนได้ |
| Instagram Web internal REST/GraphQL | รายชื่อฟอล ความสัมพันธ์ Story และ media ที่ session มีสิทธิ์เข้าถึง | ใช้ session บน Instagram; ไม่มีสัญญาความเข้ากันได้หรือ quota สาธารณะ |
| Instagram API ทางการ | จัดการบัญชี Professional ที่อนุญาตให้ app เข้าถึง: media, publishing, comments, insights ตามสิทธิ์ | ต้อง Meta app, authorization, access token และ permissions; ไม่ใช่ API อ่านทุกบัญชีผ่าน browser login |

Meta แยก Instagram Login และ Facebook Login; แบบ Facebook Login ต้องเชื่อม Facebook Page กับ Professional account ส่วน Instagram Login ใช้ flow ของตนเอง อย่านำ scope/token/host ของสองแบบมาปนกัน ไม่พบ endpoint ทางการในเอกสารที่ตรวจสำหรับ enumerate รายชื่อ followers/following ทั้งหมด จึงไม่ควรเลือก Graph API เป็นฐานฟีเจอร์หาใครไม่ follow กลับ [S1, S2]

ข้อเสนอสำหรับโปรเจกต์: ใช้ข้อมูลที่โหลดแล้วก่อน จากนั้นเรียก internal API เท่าที่ผู้ใช้ร้องขอ หากเพิ่มเครื่องมือสำหรับ Creator/Business ค่อยประเมิน API ทางการแยกเป็นอีกช่องทาง

## 2. Flow ของ Extension

```text
ผู้ใช้กดฟีเจอร์ใน Popup / Side panel
  → ตรวจ active tab เป็น Instagram และยังล็อกอิน
  → ส่งคำสั่งไป Content script ของ tab นั้น
  → อ่านข้อมูลที่หน้าเว็บมี หรือ fetch same-origin
  → ส่งเฉพาะข้อมูลที่ฟีเจอร์ต้องใช้กลับ UI
  → ส่งงานบันทึกไฟล์ไป Extension service worker เมื่อจำเป็น
```

- `Content script`: อ่าน DOM, ตรวจบริบทบัญชี และเรียก same-origin REST บน `https://www.instagram.com` โดยใช้ session ของ browser
- `MAIN world`: เพิ่มเฉพาะเมื่อต้องอ่านตัวแปร/page state ของ Instagram เพราะ content script ปกติอยู่ `ISOLATED` world และเข้าถึงตัวแปร JavaScript ของหน้าโดยตรงไม่ได้ [S3]
- `Service worker`: จัดการ storage และ download; cross-origin fetch ต้องมี host permissions ที่ตรงปลายทาง แต่ host permission ไม่ข้ามสิทธิ์บัญชี Instagram และไม่ทำให้ content-script fetch ข้าม CORS ได้ [S4]
- Popup ปิดแล้วไม่ควรทำให้งานหายโดยไม่แจ้ง; งานยาวต้องมี progress, cancel และ checkpoint ไม่พึ่ง global variable ของ service worker เพราะอาจถูกหยุดแล้วเริ่มใหม่ [S5]

### Rule ที่ต้องบังคับจริง

1. ตรวจ URL ด้วย URL parser และ exact hostname/allowlist; อย่าใช้ `url.includes('instagram.com')`
2. แยก `viewerUserId` (บัญชีล็อกอิน) กับ `targetUserId` (บัญชีที่กำลังดู) เสมอ
3. หากต้องอยู่หน้า Instagram ตลอดงาน ให้หยุด/พักเมื่อ tab เปลี่ยน origin, ปิด หรือ logout; ระบุด้วยว่ายอมให้สลับไป tab อื่นหรือไม่
4. Instagram เป็น SPA: เปลี่ยน profile โดยไม่ reload ได้ ต้องเปลี่ยน target และยกเลิกผลลัพธ์เก่าที่กลับมาช้า
5. บัญชี private/Close Friends/บัญชีที่ block หรือเนื้อหาจำกัด ต้องเคารพสิทธิ์ที่ session ปัจจุบันมี; Extension ไม่เพิ่มสิทธิ์เข้าถึง

## 3. API สำหรับฟีเจอร์หลัก

ตารางนี้เป็น **internal API ที่พบใน local reference** [L1–L4] ทุก path ใช้กับ `https://www.instagram.com` เว้นแต่ระบุเป็นอย่างอื่น ต้องตรวจ Request/Response ล่าสุดจาก DevTools ก่อนนำไปพัฒนา

| ฟีเจอร์ | Method และ path | ข้อมูล/ข้อสังเกต |
| --- | --- | --- |
| Profile/ยอดฟอล | `GET /api/v1/users/{userId}/info/` | ตรวจ `user.follower_count`, `following_count`, `media_count`; field อาจขาดหรือเปลี่ยน |
| หา ID จาก username | `GET /api/v1/users/web_profile_info/?username={username}` | รูปแบบที่พบใช้ `data.user`; อาจมี counts แบบ nested เช่น `edge_followed_by.count`; endpoint อาจถูกจำกัด จึงควรใช้ ID ที่หน้าโหลดไว้ก่อน |
| Search username เป็น fallback | `GET /web/search/topsearch/?query={username}` | เลือก username ตรงกันเท่านั้น ไม่หยิบผลแรก; URL-encode query |
| รายชื่อผู้ติดตาม | `GET /api/v1/friendships/{userId}/followers/?count=50` | `users`, `next_max_id`; จำนวนที่คืนอาจน้อยกว่า count |
| รายชื่อที่กำลังติดตาม | `GET /api/v1/friendships/{userId}/following/?count=50` | หน้าถัดไปส่ง `max_id` จาก `next_max_id` |
| Follow กันหรือไม่ | `GET /api/v1/friendships/show/{userId}/` | `following`, `followed_by` เป็นความสัมพันธ์กับบัญชีล็อกอิน ไม่ใช่บัญชีเป้าหมายสองบัญชีใด ๆ |
| Story ที่ session เข้าถึงได้ | `GET /api/v1/feed/reels_media/?reel_ids={userId}` | reference รองรับ response ทั้ง `reels` และ `reels_media`; media อยู่ใน `items` |
| Highlight ที่ทราบ ID | `GET /api/v1/feed/reels_media/?reel_ids=highlight%3A{highlightId}` | reference รองรับ reel ID แบบ `highlight:{id}`; ไม่ใช่ endpoint สำหรับค้นหารายการ highlight ทั้งหมด |
| รายละเอียดโพสต์/Reel | `GET /api/v1/media/{mediaId}/info/` | อ่าน `items`; ต้อง media ID ไม่ใช่นำ shortcode ไปใส่ตรง ๆ |
| โพสต์ใน profile แบบหลายหน้า | GraphQL request ของหน้า profile | local reference จับ request `PolarisProfilePostsQuery` แล้วใช้ cursor; ไม่ควร hardcode `doc_id` จากบทความเก่า |
| โหลดรูป/วิดีโอ | URL media จาก response → `chrome.downloads.download` | การบันทึกไฟล์เป็นคนละขั้นกับการขอ metadata; ดูหัวข้อ 7 |

**หมายเหตุ:** ชื่อ `reels_media` ใน Story endpoint ไม่ได้หมายความว่าเป็นรายการวิดีโอ Instagram Reels ใน profile

### GraphQL ต้องรู้อะไร

reference ใช้ request template ของหน้าเว็บจริง พร้อม body, headers และ tokens แล้วแก้ variables สำหรับ pagination [L3] จึงไม่มี `doc_id` ตายตัวให้คัดลอกในเอกสารนี้ ต้องตรวจ URL/method/body ล่าสุดจาก Network ของหน้าเป้าหมาย

หาก template ยังไม่ถูกจับ ให้ผู้ใช้เปิด/reload profile แล้วลองใหม่ อย่าสร้าง request ด้วย token เดาหรือ retry วน วิธีอ่าน Relay store และชื่อ query เป็น implementation ภายในที่เปลี่ยนได้ เช่นเดียวกับ REST

## 4. Authentication และ headers

- ใช้ browser session ที่ล็อกอินอยู่ ไม่ขอ password, OTP หรือให้ผู้ใช้คัดลอก `sessionid`
- Same-origin request ใช้ `credentials: 'include'`; browser เป็นผู้แนบ session cookies ภายใต้ข้อกำหนดของมัน
- `ds_user_id` เป็น ID บัญชีล็อกอิน ไม่ใช่ access token; อ่านไม่ได้ต้องแสดงว่าตรวจ session ไม่สำเร็จ ไม่เดาว่าล็อกอินแล้ว
- `csrftoken` อาจอ่านได้จาก cookie ที่ไม่ใช่ HttpOnly; script อ่าน HttpOnly session cookie ไม่ได้ และไม่ควรออกแบบให้ต้องอ่าน
- local reference ใช้ `X-IG-App-ID: 936619743392459`, `X-CSRFToken`, `X-Requested-With: XMLHttpRequest`; บาง request มี `X-ASBD-ID`, `X-IG-WWW-Claim`, `X-Web-Session-ID` ด้วย [L2]
- ค่า app ID ข้างต้นเป็นค่าที่พบในซอร์ส ไม่ใช่ secret, API key ส่วนตัว หรือหลักฐานว่า server จะอนุญาต request; อย่าคัดลอก claim/session/header ของบัญชีอื่น
- ใช้ headers เท่าที่ endpoint ล่าสุดต้องการ ไม่ถือว่าทุกรายการจำเป็นทุก request; ให้ browser จัดการ `Cookie`, `Origin`, `Referer` ตามกฎ Fetch แทนการปลอมด้วย object headers
- Login บน instagram.com ไม่เท่ากับ OAuth access token ของ Meta Graph API

## 5. ยอดฟอล รายชื่อ และ snapshot

### แสดงยอดอย่างเดียว

เริ่มจาก profile data ที่หน้าโหลดแล้ว หากไม่พอค่อยตรวจ `/users/{id}/info/` อ่านค่าที่เป็นตัวเลขจริง; DOM อาจแสดง `1.2K` ซึ่งไม่เหมาะกับการเก็บยอดละเอียด field หายต้องแสดง unavailable ไม่แปลงเป็นศูนย์

### เปรียบเทียบรายชื่อ

กำหนด `followers` เป็นชุดคนติดตามเรา และ `following` เป็นชุดที่เราติดตาม:

| ผลลัพธ์ | การคำนวณ |
| --- | --- |
| เราติดตาม แต่เขาไม่ติดตามกลับ | `following − followers` |
| เขาติดตาม แต่เราไม่ติดตามกลับ | `followers − following` |
| ติดตามกันทั้งสองฝ่าย | `followers ∩ following` |

เก็บ user ID เป็น string และใช้เป็น key; username เปลี่ยนได้ และ ID ขนาดใหญ่เสี่ยงเสียความแม่นยำหากแปลงเป็น JavaScript Number

Pagination: ส่ง `max_id` ตาม cursor ที่ server คืน → deduplicate ตาม ID → หยุดเมื่อไม่มี cursor; หาก cursor ซ้ำหรือไม่มีความคืบหน้าให้หยุดพร้อมสถานะ incomplete ห้ามใช้ `users.length < count` เป็นเหตุหยุดเพียงอย่างเดียว หาก response มี ranking token ให้ตรวจว่าหน้าเว็บส่งต่ออย่างไร ไม่ใส่ค่าคาดเดา

สแกนหลายหน้าไม่ได้ snapshot ณ เวลาเดียวกัน ผู้ใช้อาจ follow/unfollow ระหว่างงาน และ server อาจจำกัดข้อมูล แม้เดิน cursor จบก็ไม่ควรรับประกันว่าตรงกับยอด profile ทุกครั้ง

### ตรวจความเปลี่ยนแปลง

เก็บ `viewerUserId`, `targetUserId`, เวลาเริ่ม/จบ, รายชื่อ ID, ยอด profile, cursor, จำนวนที่ดึงได้ และสถานะ complete/incomplete แยกตามบัญชี

เปรียบเทียบเฉพาะ snapshot ที่เข้ากันได้และดึงจบแล้ว อย่านำ partial scan ไปสรุปว่าใคร unfollow; แม้ ID หายจาก snapshot ใหม่ ก็อาจเกิดจาก block, deactivate หรือข้อจำกัดข้อมูล ควรใช้คำว่า “ไม่พบในรายการล่าสุด” พร้อมเวลาอ้างอิง

## 6. Story และ Highlight

Flow: ระบุ target ID → ใช้ Story data ที่โหลดแล้ว หรือเรียก `reels_media` → อ่าน `items` → เลือก media candidate → preview/download ตามคำสั่งผู้ใช้

- รองรับรูปและวิดีโอ; Story response ว่างอาจหมายถึงไม่มี Story ที่ session เข้าถึงได้ ไม่ใช่ข้อสรุปว่าเจ้าของไม่เคยโพสต์
- Story ที่หมดอายุ/ลบแล้ว ไม่ควรสัญญาว่าดึงคืนได้; Highlight เป็นอีกชุดที่ต้องทราบ ID และยังเข้าถึงได้
- แยก “โหลด metadata/media” ออกจาก “เปิด Story viewer” และ “ส่ง seen event” การเปิด viewer ของ Instagram อาจบันทึกว่าอ่านแล้ว
- **อย่ารับประกัน anonymous viewing:** การไม่ส่ง seen request ที่ Extension รู้จัก ไม่ได้พิสูจน์ว่าไม่มีช่องทางอื่นบันทึกการดู
- ไม่จำเป็นต้องเพิ่มการบล็อก seen เป็นส่วนของฟีเจอร์ดู/โหลด Story; หากจะทำต้องตรวจพฤติกรรมแยกอย่างชัดเจน
- ดาวน์โหลด media อย่างเดียวอาจไม่รวม sticker, เพลง, mention และ overlay ตามที่ viewer render; ห้ามรับปากว่าเหมือน Story ต้นฉบับทุกองค์ประกอบ

ข้อสังเกตนี้มาจากการออกแบบใน reference ไม่ใช่ผลทดสอบการบันทึก view ของบัญชีจริง [L1, L4]

## 7. โหลดโพสต์เป้าหมาย รูป วิดีโอ และ Reels

แยกความต้องการเป็น “โพสต์เดียวจาก URL” กับ “หลายโพสต์จาก profile” เพราะแบบหลังต้อง pagination และมี request มากกว่า

1. รับ URL ที่ผู้ใช้เลือก เช่น `/p/{shortcode}/` หรือ `/reel/{shortcode}/`; ตรวจ host และ path ก่อน
2. หา media ใน page data ก่อน ถ้ายังไม่มีค่อย resolve media ID และเรียก `/media/{mediaId}/info/`
3. reference มีตัวแปลง shortcode → media ID แต่เป็น logic ภายใน ต้องทดสอบกับรูปแบบ URL จริง ไม่แปลงด้วย Number ที่อาจ overflow [L5]
4. แยก `media_type`: `1` รูป, `2` วิดีโอ, `8` carousel ตามรูปแบบที่ reference รองรับ
5. รูปใช้ `image_versions2.candidates`; วิดีโอใช้ `video_versions`; carousel เดิน `carousel_media` ทีละรายการ เก็บลำดับและรองรับรูป/วิดีโอผสม [L4]
6. เลือกคุณภาพสูงสุดจาก candidate ที่ได้รับ ไม่สัญญาว่าเป็นไฟล์ต้นฉบับ; ถ้ามีเฉพาะ stream/manifest ให้ระบุว่ายังไม่รองรับ แทนการบันทึก thumbnail เป็นวิดีโอ
7. ส่ง URL ไป Extension context เพื่อเริ่ม download และติดตามผล; ต้องมี permission `downloads` [S6]

CDN URLs อาจหมดอายุหรือคืน 403: ขอ metadata ใหม่เมื่อจำเป็น จำกัด retry และแจ้งผลต่อไฟล์ ไม่เก็บ URL เป็น permanent reference; เก็บ media ID/shortcode เป็นตัวอ้างอิงหลัก

การโหลดไฟล์ตรงผ่าน download manager ต่างจาก fetch bytes เพื่อทำ ZIP: แบบ ZIP ต้องตรวจ CORS/host permissions ของ CDN, ขนาดไฟล์ และ memory แยกต่างหาก ไม่ควรเพิ่ม ZIP dependency ตั้งแต่ฟีเจอร์ดาวน์โหลดไฟล์แรก

ตั้งชื่อไฟล์จากข้อมูลที่ sanitize แล้ว เช่น username, media ID และลำดับ ห้ามให้ caption หรือ input กำหนด path ได้ตรง ๆ ตรวจ URL เป็น HTTPS และ hostname อยู่ใน CDN allowlist ที่ตรวจจาก response จริง ไม่ใช้ substring เพื่อยอมรับ hostname

## 8. ฟีเจอร์เพิ่มเติมที่ต่อยอดได้

| ฟีเจอร์ | ข้อมูลที่ต้องใช้ | ข้อควรทราบ |
| --- | --- | --- |
| Badge ว่า follow กันหรือไม่ | page relationship หรือ `friendships/show` | ขอเฉพาะ profile ที่กำลังดู ไม่ยิงทุก username บนหน้า |
| กราฟยอดฟอลย้อนหลัง | counts snapshot | แสดงเฉพาะประวัติตั้งแต่เริ่มเก็บ |
| Export รายชื่อ CSV/JSON | รายชื่อที่ดึงได้ | แนบเวลาและสถานะความครบถ้วน; CSV ต้องกัน formula injection จากข้อความผู้ใช้ |
| Preview/โหลดรูป profile | profile data | ใช้คุณภาพที่ API คืนได้จริง |
| คัดลอก caption/ลิงก์โพสต์ | post metadata/DOM | ส่วนมากใช้ข้อมูลที่โหลดแล้วได้ |
| โหลด carousel ที่เลือก | media metadata | แสดงจำนวนและเลือกไฟล์ก่อนเริ่ม |
| Bookmark/โน้ตส่วนตัว | URL และ extension storage | ทำ local ได้โดยไม่เรียก Instagram API เพิ่ม |
| ค้นหาหรือกรองรายชื่อ | snapshot ในเครื่อง | ไม่ต้องยิง request ซ้ำทุกครั้งที่พิมพ์ |
| Insights สำหรับบัญชี Professional | API ทางการและ permissions | แยก OAuth flow และตรวจ metric ที่รองรับในเวอร์ชันนั้น |

ไม่แนะนำเริ่มด้วย bulk follow/unfollow, like/comment automation หรือ DM: เป็นการเขียนข้อมูล มีผลต่อบัญชีจริง และต้องออกแบบการยืนยัน/error recovery เพิ่ม เอกสารนี้จึงไม่เสนอ write endpoint เป็นส่วนของงานเริ่มต้น

## 9. Rate limit และ error ที่ต้องออกแบบรองรับ

ไม่มีตัวเลข “ปลอดภัยแน่นอน” สำหรับ internal API; quota ของ Graph API ไม่ใช่ quota ของ Instagram Web การเว้นช่วงไม่รับประกันว่าจะไม่ถูกจำกัด

| อาการ | การจัดการ |
| --- | --- |
| `401`, `login_required`, redirect ไปหน้า login | หยุดงาน ให้ผู้ใช้ตรวจ login บน Instagram |
| `403`, `challenge_required`, `checkpoint_required` | หยุด ให้ผู้ใช้ดำเนินการบนเว็บเอง ไม่ bypass challenge |
| `429`, `feedback_required` หรือข้อความให้รอ | หยุด request ของงาน ใช้ `Retry-After` หากมี และ cooldown ร่วมข้าม tab |
| `404` | อาจลบแล้ว ไม่มีสิทธิ์ หรือ endpoint เปลี่ยน; ไม่สรุปว่า username ไม่มีอยู่ทันที |
| HTTP `200` แต่เป็น HTML/redirect | ตรวจ content type/body ก่อน parse JSON |
| HTTP `200` แต่ `status: fail` หรือ GraphQL errors | ถือเป็น failure ไม่แสดงว่าดึงสำเร็จ |
| timeout/network error | retry แบบจำกัดเฉพาะ read ที่เหมาะสม พร้อม backoff/cancel |
| field หาย/response shape เปลี่ยน | แจ้งว่าไม่รองรับ response ปัจจุบัน อย่าแทนด้วยศูนย์/ชุดว่าง |

ใช้คิวทีละงาน, cache, จำกัดจำนวนหน้าต่องาน และปุ่มหยุด; ไม่สแกนอัตโนมัติทุกครั้งที่เปิด Instagram หลาย tab ต้องไม่สร้าง scanner ซ้อนกัน reference ใช้ cooldown 30 นาทีเป็นนโยบายของโปรแกรมนั้น ไม่ใช่เวลาปลดล็อกที่ Meta รับรอง [L1]

## 10. Permissions ความปลอดภัย และการเผยแพร่

| Permission/กลไก | ขอเมื่อ |
| --- | --- |
| Content-script `matches` | ต้องทำงานบนหน้า Instagram ที่กำหนด |
| `host_permissions` | ส่วนที่ต้องใช้ต้องเข้าถึง origin นั้น; จำกัด Instagram/CDN ที่จำเป็น |
| `activeTab` + `scripting` | เลือก inject ตามการกดของผู้ใช้; เป็นทางเลือกต่อการ inject แบบ static ไม่จำเป็นต้องขอทุกอย่างพร้อมกัน |
| `storage` | เก็บ settings, snapshot และ checkpoint |
| `downloads` | เริ่มและติดตามการบันทึกไฟล์ |
| `cookies` | ใช้ Cookies API จริง; ไม่ต้องขอเพียงเพื่อให้ same-origin fetch ส่ง cookie |

- Message handler รับเฉพาะ operation ที่กำหนด ตรวจ sender/tab และ validate ID/path/URL; อย่าให้หน้าเว็บสั่ง service worker fetch URL ใดก็ได้
- MAIN-world bridge ไม่ใช่ขอบเขตที่เชื่อถือได้เท่า extension context; หน้าเว็บแชร์ environment นั้น ตรวจข้อมูลทุกครั้ง และไม่ส่ง secrets ผ่าน bridge
- แสดง caption/username เป็นข้อความ ไม่ใช้ `innerHTML` กับ response [S4]
- เก็บ snapshot แยกบัญชี มีปุ่มลบข้อมูล ไม่บันทึก cookies, tokens, authorization headers หรือ raw response ส่วนตัวลง log
- หากใช้ OAuth ทางการ อย่าฝัง app secret ใน Extension ที่แจกผู้ใช้
- เปิดเผยการใช้ข้อมูลและขอ permissions ตามฟีเจอร์จริง; ตรวจข้อกำหนด Chrome Web Store ก่อนส่ง [S7]
- Bundle executable code มากับ Extension; การโหลด media/JSON เป็นข้อมูลต่างจากดาวน์โหลด JavaScript มารัน ซึ่ง MV3 จำกัด [S8]
- การมีหลายฟีเจอร์ควรอยู่ใต้จุดประสงค์เดียวที่อธิบายได้ เช่น “เครื่องมือดูแลความสัมพันธ์และจัดการสื่อ Instagram” ไม่เพิ่มการเก็บข้อมูลนอกขอบเขตที่แจ้ง
- การล็อกอินและเห็นข้อมูลไม่ได้แปลว่าได้รับอนุญาตให้เก็บอัตโนมัติหรือเผยแพร่ซ้ำ ต้องตรวจ Terms และสิทธิ์ของเจ้าของสื่อก่อนเผยแพร่ผลิตภัณฑ์; หน้า Terms ทางการเข้าถึงไม่ได้ในการค้นครั้งนี้ จึงไม่ได้สรุปข้อกฎหมายแทนเอกสารต้นทาง [S9]

## 11. วิธีตรวจ endpoint ก่อนเริ่มเขียน

1. ใช้บัญชีทดสอบที่ยอมรับผลกระทบได้ เปิด DevTools → Network → Fetch/XHR
2. ทำกิจกรรมทีละอย่าง: เปิด profile, รายชื่อ followers, Story หรือโพสต์ที่ตนมีสิทธิ์ดู
3. บันทึก method, path, query/body shape, ชื่อ headers ที่จำเป็น และ response shape แบบลบข้อมูลส่วนตัว
4. ทดลองหนึ่งหน้า/หนึ่งโพสต์ก่อน ตรวจ JSON, IDs, cursor, error และ side effect โดยเฉพาะ Story seen
5. เปรียบเทียบ content-script fetch กับพฤติกรรมหน้าเว็บ; อย่าเริ่มด้วยการย้ายทุก request ไป service worker
6. ก่อนแชร์ HAR หรือ Copy as cURL ต้องลบ cookies/tokens/headers ส่วนตัว; ห้ามนำ session ไป commit
7. ทดสอบ logout, private target ที่ไม่มีสิทธิ์, ยกเลิกงาน, เปลี่ยนบัญชี/หน้า และ response incomplete ด้วย

ลำดับทำงานที่เสนอ: **ยอดและ profile → ความสัมพันธ์รายบัญชี → สแกนรายชื่อพร้อม progress → เปรียบเทียบ/snapshot → โหลดโพสต์เดียวและ carousel → Story/Highlight → หลายโพสต์จาก profile** แต่ละขั้นใช้ข้อมูลร่วมที่มีอยู่ได้ ไม่ต้องสร้าง framework รองรับทุก API ล่วงหน้า

## 12. สถานะโปรเจกต์และแหล่งอ้างอิง

โค้ดปัจจุบันมี `TEST_FETCH_FOLLOWING` ใน `entrypoints/content.ts` และ fallback ใน `entrypoints/popup/services/instagram.ts` ดึง following `count=10`; ยังไม่มี pagination, followers scan, Story หรือ download flow ในส่วนนี้ และ `fetchUserProfile` ยังไม่คืนยอดฟอล

ตัวอย่างใน `research/` เป็น reference สำหรับศึกษา ไม่ใช่ implementation ที่ต้องยกมาทั้งชุด; ตรวจ license ก่อนนำโค้ดมาใช้ และอย่าถือข้อความว่า “ตรวจแล้ว” ใน README ของ reference เป็นผลทดสอบของเรา

### เอกสารทางการ

- [S1: Meta Instagram API collection และ Facebook Login](https://www.postman.com/meta/instagram/collection/6yqw8pt/instagram-api)
- [S2: Meta Instagram Login และ permission scopes](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-af579d08-121e-4897-8f45-5fd41ace49df)
- [S3: Chrome content scripts และ isolated world](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [S4: Chrome cross-origin network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [S5: Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [S6: Chrome downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads)
- [S7: Chrome Web Store privacy disclosures](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/)
- [S8: Additional requirements for Manifest V3](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [S9: Instagram Terms of Use — เปิดอ่านไม่สำเร็จระหว่างค้นคว้า](https://help.instagram.com/581066165581870)

หน้า Meta Developers สำหรับ Instagram Login/Facebook Login ตอบ `429` ระหว่างค้นคว้า จึงใช้ collection ที่ Meta เผยแพร่บน Postman เป็นหลัก ไม่ได้ยืนยัน schema ของ Graph API version ล่าสุดจากหน้า Developers โดยตรง

### Local reference ที่ตรวจจริง

- [L1: REST wrapper, pagination, relationship, Story และ media lookup](research/glassgram/src/content/core/api.ts)
- [L2: Header construction](research/glassgram/src/content/core/headers.ts)
- [L3: Page bridge และ GraphQL request templates](research/glassgram/src/inject/main-world.ts)
- [L4: Image/video/carousel normalization และ URL expiry](research/glassgram/src/content/core/media.ts)
- [L5: Shortcode conversion](research/glassgram/src/content/core/shortcode.ts)
- [โค้ด Extension ปัจจุบัน: content script](entrypoints/content.ts)
- [โค้ด Extension ปัจจุบัน: Instagram service](entrypoints/popup/services/instagram.ts)
