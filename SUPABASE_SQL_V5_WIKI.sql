-- NS_To-Do v5: 의국 노트 (위키) 스키마 + 초기 데이터 113개

CREATE TABLE IF NOT EXISTS wiki_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wiki_documents (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT REFERENCES wiki_categories(id) ON DELETE SET NULL,
  parent_id BIGINT REFERENCES wiki_documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  display_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wiki_docs_category ON wiki_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_wiki_docs_parent ON wiki_documents(parent_id);

ALTER TABLE wiki_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read wiki_categories" ON wiki_categories;
DROP POLICY IF EXISTS "everyone insert wiki_categories" ON wiki_categories;
DROP POLICY IF EXISTS "everyone update wiki_categories" ON wiki_categories;
DROP POLICY IF EXISTS "everyone delete wiki_categories" ON wiki_categories;
CREATE POLICY "everyone read wiki_categories" ON wiki_categories FOR SELECT USING (true);
CREATE POLICY "everyone insert wiki_categories" ON wiki_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "everyone update wiki_categories" ON wiki_categories FOR UPDATE USING (true);
CREATE POLICY "everyone delete wiki_categories" ON wiki_categories FOR DELETE USING (true);

ALTER TABLE wiki_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read wiki_documents" ON wiki_documents;
DROP POLICY IF EXISTS "everyone insert wiki_documents" ON wiki_documents;
DROP POLICY IF EXISTS "everyone update wiki_documents" ON wiki_documents;
DROP POLICY IF EXISTS "everyone delete wiki_documents" ON wiki_documents;
CREATE POLICY "everyone read wiki_documents" ON wiki_documents FOR SELECT USING (true);
CREATE POLICY "everyone insert wiki_documents" ON wiki_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "everyone update wiki_documents" ON wiki_documents FOR UPDATE USING (true);
CREATE POLICY "everyone delete wiki_documents" ON wiki_documents FOR DELETE USING (true);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE wiki_categories;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE wiki_documents;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 카테고리 8개
INSERT INTO wiki_categories (name, display_order) VALUES ('수술·시술', 1) ON CONFLICT (name) DO NOTHING;
INSERT INTO wiki_categories (name, display_order) VALUES ('질환별 관리', 2) ON CONFLICT (name) DO NOTHING;
INSERT INTO wiki_categories (name, display_order) VALUES ('약물·처방', 3) ON CONFLICT (name) DO NOTHING;
INSERT INTO wiki_categories (name, display_order) VALUES ('ICU·병동', 4) ON CONFLICT (name) DO NOTHING;
INSERT INTO wiki_categories (name, display_order) VALUES ('검사·영상', 5) ON CONFLICT (name) DO NOTHING;
INSERT INTO wiki_categories (name, display_order) VALUES ('행정·서류', 6) ON CONFLICT (name) DO NOTHING;
INSERT INTO wiki_categories (name, display_order) VALUES ('일정·당직', 7) ON CONFLICT (name) DO NOTHING;
INSERT INTO wiki_categories (name, display_order) VALUES ('신환·인계', 8) ON CONFLICT (name) DO NOTHING;

-- 문서 113개 (Notion 이관, zoom 제외)
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '220417', 'Y

교수님 라운딩 후 노티드립니다.

문점석 L45S1 TLIF POD#4 drain 40/50, Lt hemovac 40 제거하겠습니다. 근력 변화 없고. 환자분 보행 연습중입니다.

이영숙 L2345 TLIF POD#4 drain 80, 양쪽 앞쪽 허벅지 통증 lyrica 75mg 추가 후 호전추세이며 ambulation 잘 합니다.

이외 병동환자 특이사항 없습니다.

R

교수님 라운딩 후 노티드립니다.

임남순 C34 PHL POD#3 drain 30, 사지 근력 저하 변화 없습니다. hemovac 30 제거하겠습니다.

전상현 C45 fusion POD#2 drain 7, ambulation 격려하고 JP 7 제거하겠습니다.

이외 병동환자 특이사항 없습니다.

추가

Y
박삼순 -
이영숙 Lyrica75 추가후 통증 호전 추세, ambulation 잘 함
이영자 월 퇴원
문점석 ambulation 연습중, HV제거(Lt)
박가용 22일 인천성모 외래
주덕순 op site, 양측 어깨 통증 호전추세
김막내 특이호소 없음

R
김순배 -
문성흠 wheel chair ambulation 중. 재활치료 열심히 다님
최재환 JP제거후 특이호소 없음
임남순 HV제거, active PTx 협진+
전상현 JP제거', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '3제요법', '반코 1g q12

트리악손 2g q12

메트로 500mg q8', '이관' FROM wiki_categories WHERE name = '약물·처방';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'ACDF', '너무 ext하지않기

병변 반대쪽 approach

![1000018586.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_010.jpg)

![1000018585.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_009.jpg)', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Aneurysm, Coil, Stent', '두통양상, aura

TFCA

-가예약

![20220417_171024.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_037.jpg)

-날짜에 아무시간 선택

hx

ct + 안지오

bp control 럽쳐시 140까지

cetrazole 1g (ast용) 1g (or) 2g (or)

sah 

sdh 두께 midline brainstem

교수님노티

혈촬쌤들

pa쌤

마취과 -프메포함

both inguinal shaving 폴리 

## 코일

- 스텐트 안넣으면 항혈전제 안씀
- npo 하루만- 밥줘
- 중환자실에서 1~2일
- brain diffusion mri 3.0t 코일 pod1약속처방
- gre는 마이크로블리딩시
- fisher grade, hh 기록
- post op ct 찍음, 언럽쳐 b는 안찍음
- 정규코일 입실시 코일오더 넣고, 꼭 자가약이나 외래처방기록 보고 아스피린플라빅스 챙기기
- b는 정규코일때 아스피린+에피언트
- b코일 전날은 아스피린 300, 에피언트 20(10 x 2TB) loading, 다음날부터 100/5, 판토라인도 챙기기
- b 정규코일때4시간후 sips 후 식이 시작, tpn달지말기

## 응급코일

- bp control
- 교수님노티
- 혈촬쌤들
- pa쌤
- 마취과 -프메포함
- both inguinal shaving + foley insertion
- 

## 코일 입실

- 노말40
- 티피엔40
- 가스터뮤테란
- 포스트오피랩
- asp/plv 복용중이었으면
- b: 아스피린100, 에피언트5
- 헤파린 달면, 10cc hr
- stent-assisted 여도 voluven은 필요 없음

## 스텐트

- 노말40
- 티피엔40- 그냥 십스하고 밥주기도
- 볼루벤20
- 가스터뮤테란
- 약속오더에 프랩약 해야됨
- post op ct 안찍음, 찍을때도 있음
- 아트로핀은?

## 클립

iom쌤들도 불러야됨

정규클립은 다음날 밥줘도 됨

니모디핀

플라즈마

페인컨트롤

hemovac

LP', '이관' FROM wiki_categories WHERE name = '질환별 관리';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'BIPAP 바이팹, 양압호흡기', 'IPAP-EPAP = support

EPAP = peep

ex ipap 15, epap 5', '이관' FROM wiki_categories WHERE name = 'ICU·병동';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Brain MRI', '- T2: screening
- Flair: SAH, edema
→ 물을 검게 바꾼 것, 피가 섞인 물은 밝게 나온다
- T1: 전체적 어둡고 enhanced와 비교위해
- DWI: 물 분자 이동
- GRE: hmg 확인하기 좋음', '이관' FROM wiki_categories WHERE name = '검사·영상';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Brain tumor', '→ 인체유래물동의서

→ stereotactic

# P/E

- 지남력

# notify

- motor
    - tumor 진행 방향이 meninges 인지 intraaxial 인지?
- RT or CT ? → 횟수, 어떤 chemo?
- PET CT 결과
- 외래기록상 tumor care plan

pain control!!!!

## 설명

icu대기 

개두술 의식저하 경련발작 영구적손상 사망

![20220503_001105.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_040.jpg)

![20220503_001128.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_041.jpg)

덱사유지?

페인컨트롤

포스트mri? = 루틴mri (brain+dwimri without+with Gd 3t)-comment= GD thin cut, 3d reconstruction', '이관' FROM wiki_categories WHERE name = '질환별 관리';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'C-post(R)', '![1695508694834.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_027.jpg)

마큇 스펀지 떼고 티스펀지 얇은것도 떼고', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'CPR', '- 내가 할 일과 지시사항을 구분

![Untitled](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_066.jpg)

![Untitled](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_067.jpg)', '이관' FROM wiki_categories WHERE name = 'ICU·병동';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'CSF lab', '→ **glc 낮으면 세균성**

→ **WBC 수 확인**

1. 종이테이프, 거즈를 푼다
2. 무균장갑
3. 거즈로 3-way 뚜껑을 잡고 돌려서 연다
4. 연결부를 베타딘 소독
5. syringe 연결
6. 3-way evd bag, syringe 방향으로 돌린다
7. 천천히 regurge
8. **3-way 살짝 돌려서 air 안들어가게**
9. disconnect
10. 연결부 베타딘 소독
11. **열어둔 뚜껑을 베타딘에 찍어서 닫는다**
12. 3-way 기존대로', '이관' FROM wiki_categories WHERE name = '검사·영상';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Central line', '- 접근방법
- 삽관 깊이

![Untitled](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_060.jpg)', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Craniectomy', 'B

펜토탈

볼루라이트

hts

![20220506_210432.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_042.jpg)', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Craniectomy (2)', 'S는 craniotomy 홀스슈로 준비

▣ 수술 전

ⓞ 팬 티, 서지패드, 아이커버, 타리비드, 면 플라스터, 바리깡, 도넛, 불판, 액세서리, 수술의자, 단무지, 무릎베게

- S , B , M : 핀세트 + 홀스슈( Horse shoe) 추가 *

① 테이블 : Normal table

② 가로포 O

③ 머 리 : 도넛(supine)

④ 액세서리, mayo stand[불판, 상] (환자머리 쪽 경계가 Nipple Level정도 되도록)

⑤ 무 릎 : 무릎베개, knee band

▣ 인덕션 및 포지션

① 인덕션: 인덕션 완료되면 타리비드 및 아이커버

② 포지션: 1. 약간 옆으로 기울인 자세(semi lateral)

노란 단무지로 옆으로 기울인 자세할 때 포 아래쪽에 받쳐줌

prone 의 경우 R c spine posterior처럼 단무지 깔기 ( 윌슨 X )

③ 무 릎 : 무릎배게 포 밑에다가 환자 허벅지 밑에 대주기, knee band', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Cranioplasty', '온콜 keppra, seizure Hx 있을때만

끝나고 gw', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Craniotomy', 'ICU adm

post op lab

gaster

muteran

smof

normal saline / plasma

tarasyn (k는 tridol)

cetrazole

target 100-160

hemovac, anti, dexa, MRI - 컨펌 받아야함

vimsk

k 튜머는 keppra 수술후 유지

k po시작하면 바로 바꾸기

post op mri는 루틴 gd mri', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Craniotomy (2)', '→ M', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Dermatome', '![0502fc7de50e985ca2b71b42ba624166.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_001.jpg)

![png-transparent-spinal-nerve-spinal-cord-vertebral-column-nerve-root-anatomy-protection-of-the-cervical-spine-human-body-human-anatomy-nerve.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_084.jpg)

![Untitled](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_069.jpg)

![Screenshot_20220510-124350_inhaTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_049.jpg)', '이관' FROM wiki_categories WHERE name = '검사·영상';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'EIAB', 'ICU adm

post op lab

gaster

muteran

smof

normal saline/ plasma - 컨펌

tarasyn

cetrazole

target 100-140 strict, indirect는 160까지

아스피린컨펌은 ct찍고 추후 교수님이 결정', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'EVD bag change', '1. 기존 3-way 거즈+종이테이프 풀기
2. 종이테이프 뜯어두기
3. **무균장갑끼기**
4. new 백 봉투 뜯기
5. 클램핑 닫기
6. 연결부분은 봉투 안쪽으로 위치하도록
7. **거즈로 잡고** 3-way를 EVD bag 쪽으로 해서 닫기
8. 기존 백 disconnect
9. 연결부위 베타딘 소독
10. new 백 연결하기
11. **거즈로 3-way 뚜껑 돌려서 열고 옆에 두기**
12. syringe 연결 부위 베타딘 소독
13. saline push하기
14. 3-way 살짝 돌려서 air 안 들어가게 하기
15. syringe disconnect
16. syringe 연결 부위 베타딘 소독
17. 기존 3-way 뚜껑도 연결부위 베타딘 소독해서 닫기
18. 거즈로 둘러싸서 마무리
19. 클램핑은 그대로 둔다', '이관' FROM wiki_categories WHERE name = 'ICU·병동';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'GCS', '![gcs.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_070.jpg)', '이관' FROM wiki_categories WHERE name = 'ICU·병동';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'ICH', '## P/E

- Motor grade → “팔 다리 들어보세요”
- 지남력 → “이름 말해보세요”
- Hx. → 과거력, 현재 복용 약물들

## 처치

- BP control : perdipine, 20, 1개 40까지 쓴다→ 140 아래로 조절
- 안지오씨티 추가로
- 지혈제 3일 사용

     * 박현선, 김경민, 배진우(B) 교수님은 지혈제 안씀

- pain control
- D출혈 세레브로리진, 케프라

## CT reading

스팟싸인 확인

## 보호자 설명

- 의식저하, 영구장애, 식물인간, 사망 가능성
- ventricle clot이 1st ventricle 막을 시 뇌압 상승 → EVD 가능성 있음
- 초기 3일 위험하며 진행 가능성 있음
- 중환자실 대기시간 길 수 있음

## Notify

- 특별한 사항만
- hmg 양이 중요, op case 인지?

    → hmg 양 측정: hmg 가장 큰 axial cut 에서 axial 가로(a), 세로(b), 컷수/4(c)

                              a x b x c = 30 cc 이상일 경우 op case (ectomy)

- **박현선, 김은영 교수님은 CT 캡쳐 후 보내기**
- 추가방에 올리기

## 경과기록 작성

- 상환 ~~ 내원이유
- 시행한 검사 (CT 등) 에서 무엇인지?
- 보호자(누구?)에게 설명한 내용 → 영구적 손상, 의식장애, 사망 가능성 포함
- 수술 가능성 → 개두술 포함 op 가능성
- 치료 plan (약물 등)

![20220409_180644.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_032.jpg)

s 노티는 인하톡', '이관' FROM wiki_categories WHERE name = '질환별 관리';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'ICU 오더', '밥

물 

약

-뮤테란 크레아틴보기

랩

포스트오피랩?

안티

타겟

통증', '이관' FROM wiki_categories WHERE name = 'ICU·병동';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'ICU, 병동', '| **내용** | **오더명** | **특이사항** |
| --- | --- | --- |
| Hyperventilation |  | PCO2 낮춰서 뇌 부종 감소시키지만 PO2 높아질 수 있음 → FiO2 줄이는 것으로 조절 (0.1씩) |
| I/O |  | +- 500 이 기본
이전에 ++인 경우 → chest 확인 후 물 뺀다
열이 난다면 ++도 봐준다 (insensible loss 감안) → hydration 더 해 줌

+++시 **lasix 1/2amp** 사용, effect 없으면 1→ 2 → 4 → continuous (10~20cc/hr) 으로 증량, 이후론 ccrt
 *SBP 100이상이어야 lasix 사용
→ +2000이어도 lasix 못 쓰고, 폐 물 안차고 electro 정상이면 N/S 주면서 obs 가능
CXR 폐에 물 차면 i/o 확인 i/o ++ 아닐 경우 노답... 
(++면 물 빼면 된다 → target -1000~0)

- - -시 target 0~+1000
→ infarct인 경우 negative 커지면 조심해야 함, 물먹는 사람 po로 물 많이

urine 300이상 두 번 일 때 DI lab → minirin 고려 |
| BT |  | R → 37.8 부터 fever
Y → 38.3 부터 fever
Brain part → 37.5 부터 fever

POD#3 까지는 atelectasis 가능성, 38.5 까지 fever study 안 함 → fever control 만
 but, local 수술인 경우 fever study 한다
 pn.에 의한 것은 confirm 없이 anti 진행 (루틴: tabactam, 4.5g, q6hr) |
| BP | 1st. **Sevika** 5/20
→ 10/40, Qd 까지
2nd. **Dilatrend** 12.5mg, Qd
→ 25mg, bid 까지
3rd. **Dichlozid** 25mg, Qd

inj. labesin

perdipine

hytrine

ESRD 환자에서 BP control | amlodipine(CCB)/olmesartan(ARB)

carvedilol (a, b 차단제)

thiazide (이뇨제)

labetalol
→ 1/2 amp이 routine 처방 (target보다 20정도 높을때...)

nicardipine (CCB)
→ 5씩 증감량하면서 혈압 조절

SAH 환자는 spasm 올 수 있어 BP 높게 유지 **(target 120~160)**, 너무 높으면 noti
→ 코일 환자는 재출혈 없다고 가정

Trauma 환자들은 **target 100~160**
ICH (by HTN**) 140 아래**로 조절 → 시간 좀 지나면 160까지도 본다

amlodipine 10mg qd + kanarb 120mg qd + dilatrend 25mg bid (+ doxazocin 2mg bid까지 추가) |
| TPN |  | 밥 먹으면 끊어주기
NPO → 연식(일반) → 상식 : 과거력으로 DM 확인 |
| 당뇨 식사 | (치료) | 1800kcal |
| PO2 |  | 100 이상시 **FiO2 0.1씩 낮추면서** 조절
target:105 - 나이/2 |
| PCO2 |  | 높을 시 **RR 2씩 높인다**
→ suction 자주해준다 |
| 그린비아 |  | diarrhea시 장솔루션으로 change |
| SMOfkabiven |  | 중심정맥관 있는 환자는 (중심) order로 |
| SpO2 |  | saturation 95% 유지시 1L씩 tappering |
| RR |  | 빠른 경우 pain control 해보기도 함
듀로제식 패치 써보기도 함 |
| dehydration |  | main fluid 높이지만 ex) 40→60, oral로 따라가는게 좋다 |
| CVP | 2~6 normal range | I/O 에서 확인 |
| shunt 후 
식사, position |  | 200 300 400 
복부를 건드리기 때문에 밥은 교수님 컨펌 받고 준다
herniation 주의해서 head elevation 각도 Pf confirm |
| 연하보조(치료) |  | infarct 환자 이걸로 try
aspiration 주의 comment |
| dizziness | 알레버트 |  |

# V/S, I/O, 밥

---

# Lab

---

| **처방** | **오더명** | **특이사항** |
| --- | --- | --- |
| Na | sodium chloride 20ml | 130대 쯤 1개 처방, 교정 안될 시 3% saline 10cc/hr start → 이후 속도조절 (15, 20 ...)
150 이상이면 2pm 추가랩 고민

***하루 10 이상 교정하지 말기** |
| K | kcl inj

k-contin 등

k-down

kalimate 5g/pk | [낮을 때]
**3 즈음 1개, 2 즈음 2개**
전날 2 대에서 교정 안 될 경우 3개 달 수도
* 밥먹기 시작하면 po 약 (1T, tid)으로
* B → K 3점 대까진 본다.

[높을 때]
kalimate po (5는 그냥 보고 6 때 하나 줌) 혹은 enema
10pk Qd,enm,1d + 5%dextrose 200ml/P 1pk

**→ note 에 “mix to main”** |
| Albumin | 20% (녹십자) | 2.8대에서 replacement
**peniramine inj. amp 함께 처방하기 |
| Hb, Hct | RBC(입원전용) | 10, 30 아래 혹은 급격한 하강에서 replacement
Hb 8 아래에서 보험 적용
**peniramine inj. amp 함께 처방하기
ex) 13 → 10 변화 있으나 Hct 30이상으로 괜찮을 시 Obs. (정규 검사로만 f/u, 추가 검사 x)

1pk당 Hb 1교정됨 (10까지 교정한다고 생각) |
| OT, PT 상승 |  | godex, 우루사(urusa), pennel 등 처방
→ 조절 안될 시 hepa-merz 추가 → 추가해도 조절 안 될시 한 번 더 추가
못 먹는 환자 → Helpovin? (    ) - aspart, ornitine 제제 |
| BST | 50dw 50ml | [낮을 때]
몇 정도로 오르는지 확인 (     )?

[높을 때]
휴마로그, 50으로 나눈 단위만큼 준다 (ex. 250 → 휴마로그 5단위)

TPN에 휴마로그 mix 하기도
→ 전날의 총량 mix |
| lactic acid |  | 4.0 가면 septic shock 으로 본다
→ lactic acid만 처치 따로 하는게 있나? |
| PLT |  | 5만 아래일 때 replacement |
| Ca | Ca gluconate 10%
+ 50 ~~~ | 빨간색 뜨면 교정 |
| P |  | 빨간색 뜨게 낮으면
→ Phosten 20ml/vial + N/S 150ml order |
| U/A |  | nitrate : infection 지표
WBC |
| Cr |  | 높은 경우 urine 괜찮은지 확인 후 muteran 주면서 본다 |
| osmolar gap |  | mannitol dose 0.5-1.5g/kg, tid~qid → 교수님 컨펌)
Osmolar gap=measured osm-[2*Na+(glucose/2)+(BUN/2.8)]
**→ B, M은 osm, electro, glucose, BUN lab 필요**
plasma osmolar gap > 55 mosmol/kg 넘는경우는 mannitol skip , f/u lab 후에 mannitol 재고려 |
| dic |  | antithrombin 보험기준 |

# Medication

---

### Antibiotics

<aside>
💡 ***note에 시작일/이유 작성**

</aside>

A**nti 사용 시 cr cl 계산**

 **→ Cr clearance 보고 용량 조절 (uptodate or 약품정보)
 → 월, 목 lab 하기
 → B, M은 anti 보통 1주일**

→ Creatinine Clearance (Cockcroft-Gault Equation) - MDCalc

→ **3차 항생제 (vancomycin, metronidazole, triaxone) 은 승인 필요**

### Pain control

*K: tarasyn X, S: tridol X → pethidine

| **처방** | **오더명** | **특이사항** |
| --- | --- | --- |
| maxnophen | default | pain control 시 주로 사용 |
| tarasyn | default | Ketorolac Tromethamine
3d 사용시 못 쓰니, **trolac 처방** |
| tridol | default | Tramadol Hydrochloride
BUN, **Cr 안 좋은 환자**들에게 NSAIDs 대체 |
| pethidine | default | tid까지 가능
PRN, 처방 이유 note 작성 |
| lyrica | default | Pregabalin
전공의선에서 결정가능
150mg 까지 증량 가능 Crcl 계산하고 → 용법 확인 |
| mypol |  | csf leakage 두통 호소시 효과 좋음 |
| celebrex | default | Celecoxib (COX2 inhibitor) |
| pelubi | 1T, bid | Pelubiprofen
60세 이하(젊은 환자)에서 celebrex 대신 사용 |
| matok?? |  |  |
| traumeel |  | 생약제제
수술 후 부기 조절 |
| denogan |  |  |
| profa |  |  |
| parlodel |  | central fever시 사용 모든게 r/o 돼야함 |
| neverpentin | 600 1T tid |  |
| targin | 10/5 1TB q12hr |  |
| nexium | 40mg x2 +n/s 100ml | 10cc/hr, 72시간 유지 |

### Routine order

### Others

| **처방** | **오더명** | **특이사항** |
| --- | --- | --- |
| gaster |  | 밥 먹으면 po로 변경 |
| muteran | 600mg, 1amp, q6hr (inj)
300mg, 1amp, bid (inj)
200mg, 1T, tid (po) | → Cr 높으면 (**1.2이상**), kidney 보호 위해 사용
→ Cr 정상이면 루틴 (inj 처방)
→ po 약 변경시 처방 변경 |
| keppra | 500mg, bid

500, q12hr (oral sol) | 항경련제
trauma에 깔아줌
3d 후 po 바꿈 → note에 바뀌는 날짜 적기
용량: 500 → 750 → 1000 (EEG + NR협진)
L-tube feeding 중일 경우 사용 (note 쌓이는 것 처리) |
| Mannitol | 100, q4hr (루틴)
*김경민 pf. → 0.3/kg 4회 | 교수님 컨펌 후 사용
만니톨 사용시 **lab f/u : Cr (kidney 손상 여부) + osm (electro 깨지는지)**
 → foley 유지
*osm 320 초과시 중단, 다음 lab 320 아래면 재시작 |
| tranexamic acid |  | 지혈제
*3d 사용 후 종료 → note에 종료 날짜 적기 |
| transamine |  | 지혈제
D교수님만 transamic acid 3d 후 전환해서 사용 |
| nimodipin | 2T, qid, 7d
1T, tid, 14d
(B는 2T qid 3주 유지) | SAH 환자에서 사용
*날짜 note에 적어두기 |
| cerebrolysin |  | 약속처방대로 사용, 언제까지?(    )
이후에 glitamin or nicetile 로 변경 |
| digoxin (디곡신) |  | AF, routine 처방에 용법 있음
digitalization, AF, HR 높을 때 (110이상 1~2시간 지속) |
| pentothal |  | 재워서 뇌 못 붓도록
distilled water 1000/pk mix후 40cc/hr
loading dose는 20cc distilled water 에 mix해서 15min loading
용량 /kg → 사진 
: 첫날 2배 용량 → 다음 2d~7d 1배 용량
*NPO 확인, gaster, muteran 주사제로 준다 |
| tropin | ? | 도파민 10인지 40까지 쓴다. 확인 (    ) |

| **처방** | **오더명** | **특이사항** |
| --- | --- | --- |
| mucomyst | 800mg, amp, q8hr | 가래 (thick) 많을 시 묽게해줌 (+nebulizer, 토닥이 → 국룰) |
| glycopyrrolate | 1amp, q12hr | 항콜린제 (부교감신경 억제)
가래, 침(watery) 많을 경우 처방 (+고빈도 흉벽자극) |
| nebulizer |  | 가래 많을 때 |
| vimsk | 하라는대로, po도 있음 | EEG 찍어두고 NR 협진 후 AED 처방 |
| nasea |  | Ramosetron Hydrochloride
구역, 구토 |
| vascam | 3mg | 3부터 시작
CT, MRI 등 irritable 환자에게 사용, bp낮출수 있음 |
| tivare |  | 0.04부터 시작
rate 낮출수있음 |
| etomidate |  | 0.5amp x2  |
| minirin | 1ug, sq | desmopressin
시간당 urine 300cc 이상일 때 (연속 2회 시 noti 받고) 시행
+ DI lab |
| lasix |  | 1/2 amp 부터
PCO2 차는 경향 있음
→ PCO2 높은 사람은 lasix 못 써서 폐에 물 찼는지 확인해야 함

po lasix는 inj의 1/2 효과, 4시간 간격으로 사용 |
| norpin |  | 0.02/kg/min 으로 시작
0.02씩 증감량 |
| vaso |  | 1.2씩조절 |
| lopmin |  | diarrhea |
| parlodel |  | central fever시
(brain 나가서 열 날 때) |
|  |  |  |

# 수액

---

| **처방** | **오더명** | **특이사항** |
| --- | --- | --- |
| 5dw dextrose |  | 머리에 안 좋다
Na 낮아지는 추세면 괜찮다?  (     ) |
| Hypertonic saline (B) |  | mannitol 대신 |
| Normal saline | 1000cc, 40cc/hr | **60세 이상에서는 20cc/hr로** |
| **Voluven (볼루벤)** | 20cc/hr (루틴) | SAH 환자의 경우 n/s과 같이 깔아줌
때에 따라 40cc/hr으로 증량 (교수님 order) |
| pentastarch 10% | 20cc/hr | infarct or SAH(coil) 환자
요샌 voluven 사용 |
| half saline |  |  |
| plasma solution |  |  |
| 후레아민 | 30~40cc hr |  |
| sodium bicarbonate | 20ml 10 amp | pH 낮을 경우 (metabolic acidosis) 교정해줌
40cc/hr or side 투약 |
| clenoic | 500ml 20cchr |  |

# 검사

---

| **검사** | **오더명** | **특이사항** |
| --- | --- | --- |
| MRI |  | Spine: MRI 오더 직접 판단해서 찍으면 됨
          → C spine: c1~2 강조 사진 있어서 주의
Brain: *교수님 컨펌 후 촬영 (Gd, tm. 등 옵션 많음) |
| Brain MRI |  |  |
| ABGA |  | intubation 한 환자만 확인 |
| Abd. supine |  | L-tube 한 환자만 확인 |
| CT |  | clot 주변 어둡게 됨 → resolving 중이라고 noti |
| CT angiography |  | IA thrombectomy 24시간 후 꼭 시행 |
| BMD | 골다공증약 컨펌 | -2.5~-3.5 : 프롤리아
-3.5 이하 or long level fusion : 이베니티, 포스테오 |

# 술기, 기계

---

| **술기** | **특이사항** |
| --- | --- |
| Hemovac (헤모박) | csf mix 되면 색 옅어짐 (**bst도 낮아짐**)
→ 환자 bst와 h-vac bst 비교해서 비슷할 시 obs.

drain 30cc 아래로 제거
 → infection 관련된 h-vac 일 경우 오래 둔다
교수님 noti → confirm 후 인턴이 제거
* Y → stapler O (lumbar) + **끝나고 x-ray 필수**
  R → stapler X

brain hemovac은 matrix suture 하기

* deep suture
→ 참고사진 확인하기 → 끝나고 pain control (pethidine) 해주기도

제거시 오더
→ culture(tip), simple + comment 2개(spine/brain) 중 하나
→ h-vac 여러개면 제거할 것 확실하게 표시
→ deep suture시 nylon 2-0 입력 |
| EVD | 시간당 10cc, 하루 240cc 생성, 교수님마다 target 다름
vertical suture 시행 |
| GCS score | → 표 확인하기 |
| optic flow | 밀어주면서 PCO2 빼줄 수 있다
→ LPM 30미만이면 의미 없음 |
| vent | [weaning]
SIMV → (점점 RR줄임) → SPONT 모드 변경 → T piece → extubation
*** extu 시 전날, 당일 dexa 0.5, q12hr + 알마겔 + NPO(re-intu)** |
| TTM | 저체온세팅 34도 +@
→ vecarone + intu (or midazolam, pentothal sedation)
shivering 없어야 함
PCO2 40위로 봐도 됨
PO2 높아도 상관 없음
but, electro는 자주 교정해주기 |
| pupil | 3mm 가 정상
밤엔 4~6mm 까지 정상으로 보기도 |
| 혈소판약물검사
P2Y12, aspirin | 아스피린 반응검사
→ aspirin, plavix 용량 확인 |
| hypothermia | electro+ABGA q6hr로 나간다 |
| foley | foley 뽑고 6시간 self 없을 시
→ BS시행 
1. 300 아래: 2시간 더 보고 **총 8시간 째 self 없을시 CIC**
**2. 300 위: CIC** |
| CRRT | UF: 시간당 얼마나 뺄건지
BF: CRRT input flow |
| ventilator | weaning
: vascam 1mg/hr 씩 tapering 해서 stop 후 mental, motor exam 해서 notify
tapering 도중 hyperventilaton 관찰될 시 notify 후 vascam 재 증량 |
| extubation | dexamethasone, almagel 전날부터 미리 챙긴다
전날, 당일, 다음날?
routine ABGA 처방 취소 |
| tracheostomy | vascam 5ml x 2개 / etomidate 1vl / vecaron 1vl / abga postop/chest ap postop /neck lat postop |
| naloxone | 연구: 이중맹검 7일 사용, 50년간 썼다, 도움되는약 |
| stereotactic |  |
| 액티라제 | act 약속오더, 두시간 클램프 여섯시간 배액 |
| cough leak test | cough leak test 해보고 1.바로 되면 덱사 0.5ample bid 주고 extu 2. 안좋으면  덱사 0.5ample bid 주고 다시 cough leak test 3. 두번 까지 cough leak test 해보고 실패시 t-stomy |

| **처방** | **오더명** | **특이사항** |
| --- | --- | --- |
| tabactam | 4.5g, q6hr (루틴) | + 5% dextrose 50 pk 함께 줌
Plt 낮추는 경향 있어, ANC 낮던 환자는 조심 → cefotaxime 2g Qd로 대체하기도? |
| cycin | 400mg, q12hr | ex) cr cl (23ml/min) 정도로 낮을 경우 400mg, q24hr 처방 |
| cetrazole | 1g, 1vial, q12hr | 머리쪽 op. 환자들, EVD 제거까지 루틴 처방
다른 anti 들어가고 있는 중이면 안 준다 |
| cephradine | 500mg, 2T, bid | op (머리 or 허리) 후 wound 안 좋으면, scalp lac., 단독 사용
5d 적용하는게 루틴 |
| ceftriaxone | 2g, 1vial, Qd | pneumocephalus 시 사용 |
| cefotaxime |  |  |
| cravit |  | 추가 사용 할 수도 |
| minocin | 2cap, bid | vasospasm 예방 기능 있어서 S 주라 할 때 있음 |
| vancomycin
tazime | 1vial, q12hr
1g, q8hr | 
2g q8 얘기하시기도 함 by 박미화 |
| amikacin | 1g, qd | 5d 코멘트 |', '이관' FROM wiki_categories WHERE name = 'ICU·병동';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'IDET', '처음 로칼은 25G

 l disq 각도, 깊이로 스파이날니들로 로칼

병변쪽 오블릭 45도 킴빈

ap에서 페디클 메디알 마진넘어서

라테랄에서 바디 앞쪽 1/3까지

앞쪽부터 위아래 지지기

마지막 dexa1 로피바1 인젝하고 종료', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Infarct', '## Hx taking

→ onset 과거력 먹는약

ia  thrombectomy  stroke

both inguinal shaving 폴리 

페리라인2개

vascam10mg

etomi20mg 1amp

dexmedin

ns500 링크 10cc/hr

icu자리프랩

tfca만 하면 우리쪽 입원 안할수도 있음

동의서 2개

로컬마취로함 

nr 수술 스텐트 삽입 동의서
(뇌혈관조영검사)

nr쪽에선 tfca,스텐트,의식하진정,지혈기구 4개 받음

[1959380](https://www.notion.so/1959380) 최명구

nihss 점수 중요

환자 보호자 설명 동의서 받기 
안지오실 어레인지  2741  pa콜   교수님 노티 중환자실
바스캄 2개 (에토미데이트 1개 프렙)
폴리삽입 인구이날 쉐이빙

dexmedine 1vl  10cc로 달고

라인 2개 잡기

뇌출혈, 실패, 뇌부종, 개두술, 조영제, 사망

현재 상황 혈관이 막힘   원인은 나중에 검사
뚫을려고 시도를 하는중
신경외과적으로  허벅지 굵은동맥 찔러서
가느다란 철사 타고 머리로 올라가서
뚫고 우산같은걸 펼쳐서 혈전이나 딱딱한거 빼내는거
이걸 혈전제거술이라하고 
골든타임 중 하나이고 최대한 빨리 해야될 
나중에 가장 좋은건 잘 뚫리고 다시 안생기는거
증상이 원래되로 좋아지는것이 최선인데 확률이 절반이 안됨
다른경우는 잘 뚫었는데 이미 뇌손상이 된경우  이 경우는 중추신경 회복이 안되고  마비된상태로 지낼 수 있으

가장 안좋은건 너무 딱딱해서 못뚫는거임
혈관이 막혔다가 갑자기 뚫리면 뒤에 있던 혈관들이 혈압을 못버텨서 터지면  뇌출혈이 크게 생기고 머리를 열어서 수술 가능성도 있고 사망, 식물인간 상태가 될 수도 있다
시도하는데 실패할수도 있다 혈관이 안좋아서 도착을 못할수도 있다

스텐트도 넣을 수 있고 여러가지 가능성이 있지만 최대한 노력 할거고 혹시 궁금한거 있을까요 
하겠다면 최대한 빨리 들어갈거고 오신다면 사진 보여드림

약으로 하는거 열명중 2~3명

nihss  피지컬 하고 어플 점수매기는거

[네이버](http://naver.me/Gcdf5eRX)

![20220410_130954.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_033.jpg)

post op ct 찍음, hmr 가능성있음

icu오더

abga 하면 혈압올라서 hmr가능성

제네럴 한 경우만 포스트옵 랩

가스터

뮤테란

트리돌 q6

노말40

볼루벤20

somf40

링스,퍼클로저 3시간, 스타클로저 1시간, 안쓰면 10시간

끝나고 brain ct

bp타겟 묻기

mri찍는다면 diffusion

**다음날**

NIHSS

3d angio ct

퇴원전 NIHSS 재측정

mtt 혈류가는시간

vol 비교

모야모야 - voluven 20 

O교수님 루틴

연구동의서 x

덱스토민 0.3mcg/kg/hr 시작준비

케프라, 가스터

→ O 교수님 post IA오더', '이관' FROM wiki_categories WHERE name = '질환별 관리';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'M', 'posterior

![image-1656459241285.jpg5336617219058512209.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_079.jpg)

![image-1656459264352.jpg4142543887207010644.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_080.jpg)

![image-1656460420152.jpg9213503102840117349.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_081.jpg)', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'M교수님 몰핀, morphine', '반앰플 q8', '이관' FROM wiki_categories WHERE name = '약물·처방';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'O 교수님 post IA오더', '![1000015213.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_004.jpg)', '이관' FROM wiki_categories WHERE name = '약물·처방';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'OLIF', '![1693359343082.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_025.jpg)

![](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_005.jpg)

![](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_006.jpg)

![](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_007.jpg)

![](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_008.jpg)', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'P E', '# Spine

- 팔 들기, 버티기
- 팔 접은거 펴고, 버티기
- 손목 꺾기, 버티기
- 감각 확인
- Hip → Knee → ankle
- pain 평가: dermatome c6,7,8 / L4, 5, S1 확인', '이관' FROM wiki_categories WHERE name = '질환별 관리';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'PEN', '1)메인시린지 2개 - 초록니들

덱사1

h-lase

리도 4

물 6

2)옴니파크 시린지 1개 - 분홍니들

옴니파크 6

물 4

3)옴니파크 3cc

---

벌룬펜

리도 4cc로 로컬먼저', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Permission', '**→ 입원기간: lumbar (7~10d), cervical (ant: 3~4d, post: 7d)**

→ 보호자는 유선동의 스피커폰 켜고

→ 추가정정동의서

### 마취 동의서

---

→ 정종권 pf.

- 수술/마취 동의서 선택
- 간, 신장, 심장 폐 부작용
- 치아손상/발치 가능성
- 인후통, 이물감, 쉰목소리

## cervical fusion

---

= 경추 전방/후방 고정술

### 설명

- 디스크 제거, 인공디스크, 나사박아
- 골유합시킴
- 약 1주일 입원, 보호자 없어도 됨
- 다음날부터 걷기 훈련
- 수술후 통증은 회복되는 경향이 있지만, 마비는 이미 손상된 신경 탓에 회복 잘 안 될 수도 있다.
- 무통주사 안함
- posterior 하는 경우 핀박아서 stapler찍는것 설명해주기

### 부작용

- Recurrent laryngeal nerve 손상시 쉰목소리, 고음 불가
- 수술 부위 부종으로 인해 기도 막을 경우 기관삽관술 시행 가능성
- posterior 접근일 경우 통증 심할 수 있음
- 100명중 1~5명은 수술 중 신경손상 가능성
- ASD (adjacent segment disease) 가능성은 5~10%
- 신경막 안에 뇌척수액 있는데, 손상될 경우 재수술 가능성 있음

## 로컬 코달블럭

---

교수님 외래 경과기록 보고 작성

성공률 확인

감염,통증,신경손상,혈관손상,재발가능성

저린감, 힘빠짐-일시적

보조기 한달 사용

일주일뒤 외래

## discectomy

---

pca -

matrix 실패 가능성 10%

lamina 좀 잘랐다가 붙임

퍼미션: 추간판 절제술

drain은 matrix 안달고, open해도 안달수도 있음

Total disc replacement tdr

---

![Screenshot_20220529-215716_KakaoTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_050.jpg)

→ 개두술동의서

→ 요추후방고정술', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Post op order', '→ EIAB

→ Craniotomy

→ cranioplasty

→ shunt

→ TSA', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Priority', '![1652131061559.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_022.jpg)

![Screenshot_20221208-060351_KakaoTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_058.jpg)', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'R교수님 진단서', '![20220427_085612.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_038.jpg)', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'SAH', '입대오더

- 지혈제 (transamic acid → 3일째 transamin 으로, vit. K)
- cerebrolysin → B는 컨펌 없이 사용
- keppra
- **nimodipine** 고려
- minocin 고려 - s
- BP: 트라우마면 160, 자발성이면 140

입기

![image-1651037595102.jpg1325762352545632949.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_078.jpg)

## 응급코일

---

지혈제안쓰고

hydration: 노말40티피엔40볼루벤20

nimodipine: 2t qid 1주, 1t tid 2주

bp 120-160

postop 랩

가스터뮤테란

fisher 

hunt grade

![Screenshot_20220713-000644_inhaTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_055.jpg)

![Screenshot_20220713-000653_inhaTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_056.jpg)', '이관' FROM wiki_categories WHERE name = '질환별 관리';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'SDH', 'd출혈

케프라

리피토 r d s - 팍스헤모리지는 안줌

b는 eld 안티 하루

수술환자면 pain control 꼭하기', '이관' FROM wiki_categories WHERE name = '질환별 관리';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'SPINE 주말회진', '→ 220417', '이관' FROM wiki_categories WHERE name = '일정·당직';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'SPINE- cord', '항문힘주기

방광기능확인-폴리꽂기

ECG

ct나 xray

covid

cord injury 의심되면, dexamethasone 5mg x q6hr, 3d
(almagel + BST order 포함)

## odontoid process fx.

- 무슨 타입인지?
- transverse 리가먼트가 밀렸는지?
- 뉴롤로지
- DTR', '이관' FROM wiki_categories WHERE name = '질환별 관리';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'SpO2 저하', '---', '이관' FROM wiki_categories WHERE name = 'ICU·병동';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Spine noti', '## 환자이름, 수술명, POD#?, drain(hemovac or JP+Lt/Rt 표시)양, 증상호소(motor/sensory), 계획

→ SPINE 주말회진

- pod1일, hvac&jp 빼는사람, 전원환자 필수 노티

- Y는 H-vac 제거 후 x-ray 확인
→ c-fusion 에서 midline 넘었는지, 나사들이 level 이 맞게 들어갔는지 확인
→ **x-ray 시행하겠습니다** 라고 noti
→ 전날 x-ray 도 캡쳐해서 보내야 함

- Y 노트는 홍쌤 컨펌

- Y, R → 카톡으로 noti 노트 전송
(Y는 영상 캡쳐해서 보냄, T2 scout image 띄우고, 2x3 바꾸고, 툴바에서 information 지우고, pg down 수 회 눌러서 마이톡 캡쳐 후 홍쌤 컨펌)

- pc block은 eod로 할 수 있어서 교수님께 여쭤보기

## 수술 노티문
→ 환자, 주소, P/E, 영상검사, ‘수술’ 설명드리겠습니다., ‘특이사항’ 같이 설명드리겠습니다.', '이관' FROM wiki_categories WHERE name = '질환별 관리';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Spine 영상검사', '- alignment 먼저 본다
- isthmus, pedicle, joint space narrowing 보면 됨
- isthmus가 가장 weak point
- bulging: 거의 정상
- herniation: protrusion(튀어나오는 입구가 더 넓으면) vs extrusion(입구보다 넓게 퍼졌을때)
- 4,5번 사이 disc 터지면 5번 루트 눌림
- spondylolisthesis: 척추 이동
- spondylolysis
- spondylosis
- 황색인대 두꺼워짐 + 디스크 튀어나옴: spinal stenosis

![Untitled](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_064.jpg)

- OPLL

![Untitled](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_065.jpg)

- burst vs compression Fx', '이관' FROM wiki_categories WHERE name = '검사·영상';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'TSA', '실라스틱(튜브) 이틀 뒤

메로셀(솜) 당일 오후

수술당일 저녁: 반대쪽 다 제거

수술다음날: 수술쪽 메로셀 제거

POD2:  수술쪽 실라스틱 제거', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'TSA (2)', '머리살짝 플랙션

![20230214_092752.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_045.jpg)', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'TSA(M)', '*M TSA 주의사항*

- 눈은 아이커버 대신에 테가덤 반 자른거로 양쪽 눈이랑 미간쪽 커버(사진첨부)
- 교수님 서는 쪽에 BP 커프 감지말기(부풀면 신경쓰이신다함)
- TSA 환자들 3D angio CT 찍으니까 네비본다하면 그 영상으로 준비하기
- 콧털 전날 병동에서 자르고 내려오기

![1693898167234.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_026.jpg)', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'Trauma', '- ectomy 가능성 (뇌부종 있을 시)
- keppra 150 x 4회 : R pf. 에게 주겠다고 confirm

      (2일 주사 후, 3일 째부터 po로 change, note작성)

- 지혈제도 3d 사용, note

## skull fracture

-', '이관' FROM wiki_categories WHERE name = '질환별 관리';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'burr hole', '▣ 수술 전
ⓞ 팬  티, 서지패드, 아이커버, 타리비드, 면 플라스터, 바리깡, 도넛, 무릎베개, knee band, 수술의자, 단무지
① 테이블 : Normal table(머리 마취과 반대쪽)
② 가로포 O
③ 머  리 : 도넛(supine)
④ 무  릎 : 무릎베개, knee band

▣ 인덕션 및 포지션
① 인덕션: 인덕션 완료되면 타리비드 및 아이커버
② 포지션: 1. 똑바로 누워서 하거나(supine) 2. 약간 옆으로 기울인 자세(semi lateral)
노란 단무지로 옆으로 기울인 자세할 때 포 맨 아래쪽에 받쳐줌
③ EKG실링, 귀솜
④ EVD 시 EKG electrode 준비

s 버홀 마켓 도넛, 팔걸이없는의자 혹시몰라 단무지

b s 둘다 evd는 whole shaving

T 는 홀스슈, 서서하심', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'cefa, cepha, 세파계열 알러지', 'gentamicin (2AM Q8hr?)', '이관' FROM wiki_categories WHERE name = '약물·처방';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'clipping', '1. **Aneurysm clipping** **[Brain][Basically Supine position]**

▣ 수술 전

ⓞ 팬 티, 서지패드, 아이커버, 타리비드, 면 플라스터, 바리깡, 도넛, 핀세트, 불판, 액세서리, Micro, 수술의자, 단무지,무릎베게

① 테이블 :Normal table

② 가로포 O

③ 머 리 : 도넛(supine)

④ 핀세트 : 핀세트준비(제대로 관절들이 다 풀어져 있나 확인, 테이블옆에 포 깔고 위에 준비)

⑤ 액세서리, mayo stand[불판, 상]

▣ 인덕션 및 포지션

① 인덕션: 인덕션 완료되면 타리비드 및 아이커버

② 포지션: 1. 똑바로 누워서 하거나(supine) 2. 약간 옆으로 기울인 자세(semi lateral)

노란 단무지로 옆으로 기울인 자세할 때 포 맨 아래쪽에 받쳐줌

③ 핀박기 : 머리 잡아주기

④ EKG실링, 귀솜

▣ 수술 후

① 보통은 Brain CT 안찍으나 찍는 경우가 간혹 있으니 1년차쌤에게 물어보고 찍는다면 Brain CT (Non Contrast)

② 수술 종료 후. 픽싱롤 준비

③ 핀 제거할 때 머리잡고 Headrest(머리판) 끼우기

④ 헤모박 있음(연결부위 2곳 실링)', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'cranioplasty', 'b plasty는 cetrazole 24시간만', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'dexa tapering 덱사', 'dexa 4mg tid
dexa 4mg bid
dexa 4mg qd
solondo 10mg tid
solondo 10mg bid
solondo 5mg tid
solondo 5mg bid
solondo 5mg qd
stop', '이관' FROM wiki_categories WHERE name = '약물·처방';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'dic, antithrombin', '![1000005736.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_002.jpg)', '이관' FROM wiki_categories WHERE name = '약물·처방';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'intubation', '- dd

![Untitled](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_068.jpg)', '이관' FROM wiki_categories WHERE name = 'ICU·병동';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'mri 급여 인정 서식지', '![20220427_111403.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_039.jpg)

dtr2++

vas는 높게 9정도

상병명 참고

![Screenshot_20220427-112033_inhaTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_047.jpg)

![Screenshot_20220427-112044_inhaTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_048.jpg)', '이관' FROM wiki_categories WHERE name = '검사·영상';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'mvd', '![1000024431.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_012.jpg)

![1000024270.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_011.jpg)

![1000025796.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_013.jpg)

![1000025797.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_014.jpg)', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'neuroplasty, caudal block', '▣ 수술 전
ⓞ 팬  티, 서지패드, C-arm, 무릎베게 2개, 작은 포 많이, 환자확인서, 국소마취 평가서
① 테이블 :OSI table 제일 아래칸으로 고정(머리 마취과쪽)
② 세로포 : 기본
③ 가로포 : 머리를 댈 수 있을 정도로 많이 필요
④ 머  리 : 두꺼운 포 다섯 개 정도 쌓는다
⑤ 무  릎 : 무릎베개 정강이 쪽대주기, knee band 안해도 됨.

▣ 인덕션 및 포지션
① 포지션: 1. 엎어진 자세 (prone) -> 배 아래 무릎베게를 대고 엎어진 자세
② 무  릎 : 무릎베개 정강이 쪽 대주기, knee band 안해도 됨.
③ 포지션 잡으면 산소포화도 측정기 환자 손에다 적용', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'post-extubation steroid', '덱사 익스투 후 12시간 후 2@ 12시간후 1@ 12시간후 1@', '이관' FROM wiki_categories WHERE name = '약물·처방';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'refo 신장용량', '- refosporen 용량 :
- Crcl 20-40 사이는 1g Q12hr
Crcl 20미만은 1g Q24hr', '이관' FROM wiki_categories WHERE name = '약물·처방';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'shunt', '끝나고 ct찍으실지 확인

x-ray 3종

일반병동으로

position 컨펌받아야함

안티 몇일? k는 pod#3까지

post op lab', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'stereotactic', '![20220630_071242.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_043.jpg)

나사가 이마랑 수직으로 들어가는지 확인

프레임 앞쪽은 젤작은나사 

뒤쪽은 그다음큰 나사

귀마개 먼저 끼우기

![Screenshot_20220630-083047_KakaoTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_051.jpg)

프레임 휘었는지 확인하기

중간점까지 직선거리도 구하기

![image-1656547496871.jpg2048678944045021190.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_082.jpg)

엉덩이에 받치기

끝나고 ct

icu

입실

루틴, 안티, aed?, pain control,', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, 'tumor conference', '튜머컨퍼

병리과 서유정 1장
방사선종양  이정심  1장
영상의학과 브레인쪽 전공의한테,

없으면 교수님  5장정도

명단이 화요일 오후 늦게 나와서 늦었다고 죄송하다고 코멘트하면서 전달여', '이관' FROM wiki_categories WHERE name = '일정·당직';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '개두술동의서', '![Screenshot_20220413-125805_KakaoTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_046.jpg)', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '공부내용', '→ Brain MRI

→ Spine 영상검사

→ CPR

→ intubation

→ Central line

→ SpO2 저하', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '교수님 당직표', '![1000015115.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_003.jpg)', '이관' FROM wiki_categories WHERE name = '일정·당직';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '교수님 면허번호', '![Screenshot_20220711-112223_inhaTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_053.jpg)', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '교수님 면허번호 (2)', '![Screenshot_20220711-112223_inhaTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_052.jpg)

김태형교수님 면허번호 88222 전문의번호 2328', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '당직표, 외래시간', '→ 외래 일정표

→ 교수님 당직표

→ 전공의 당직표

→ 혈관촬영실

→ Priority

→ 교수님 면허번호', '이관' FROM wiki_categories WHERE name = '일정·당직';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '당직표입력', '**네트워크 → w0991 → 장부 → 당직표**

- trauma: 비상
- vascular: 교수
- 주/야 교수님은 같이 입력', '이관' FROM wiki_categories WHERE name = '일정·당직';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '백업', '- NOAC주는분 ppi깔기
- CVP는 5~10mmHg
- 보조기: L2이상이면 tlso 그 아래면 lso
- **B, M: pod 1, 3, 5만 kidney pannel, 월, 목만 cbc**
- S: stent TPN 말고 sips 하고 바로 상식, voluven 달지마라
- 판독푸쉬는 정호석쌤 톡으로
- metformin POD#2부터 가능, 조영제 등 키드니문졔
- 격주로 y r 스파인 응급
- tlicks -t l, slicks -c op case 판단
- K 홀수 M 짝수
- 화요일은 코일 무조건 첫방
- r은 전날 피지컬해서 기록, 전날 첫방가능 노티
- 스크류 박은사람은 mavric view 코멘트 꼭!!!!! CT나 MRI 둘 다
- swelling 2번 4mm, 6번 2cm
- 케프라는 2일쓰고 po변경
- hmr= GRE로 확인, low
- 티아민 6엠플이 루틴
- routine gd
brain+DWI MRI(whith + without)GD   이건 루틴gd
- b교수님은 evd후 cetrazole 안씀
- ttm시 abga electro cbc bst q8
- 뇌혈관 환자 main 루틴으로 plasma solusion 달기
Stroke 환자 cardiac w/u 다하기
ICH 환자 CTA 찍을때 루틴으로 NAVI maker 이마에 붙이고 찍기!b 빔스크 50mg 이틀 100mg!
- ns-rd conference: mdcappuccino@daum.net, rowoon2@hanmail.net
- 몸무게 *6 = tidal volume?
- tpn대신: 5%덱스트로즈 1천+프레아민
- 프로포폴때 tpn 못씀
- b교수님 펜토탈: kg당 4mg, 시간당, 100mg로딩
- 날록손 gcs 346 김은경, 응급실에도 메모남기기
- 아이알코돈 prn, 뉴신타, 타진(열이나거나 하면 뉴신타에서 변경)은 r이 깔아줌
- d는 트랜자민으로 po change
- infarct aspect score 점수 낮을수록 안좋음
- pentothal mg/kg/hr, ketamin mcg/kg/min, vecaron mg/hr, ppf mg/kg/hr, precedex mcg/kg/hr, tivare mcg/kg/min
- 워터월 waterwall: OPMVCOPY/ ns0328902946
- s는 만니톨 600이 100  q4
- 1200-900-600-400-200-중단 : 만니톨
- 메트포민 metformin POD 2일까지
- spine op, dual anti 는 refosporen 1vl q8 + amikacin 2vl qd
- thiamine 6@ mix 술마신사람
- peridol 0.25@ 씩 1시간 간격으로 3번까지 주기도 함. ECG상 QTC 450까지 본다.
- 아티반 1~2mg im 같이준다
- 페닐에프린 5cc시작 40까지
- 산소처방전은 우리 못씀, 인공호흡기 처방전은 가능
- perfusion ct 는 acute stroke ct +perfusion  로
- insulin 1:1, RI 2 unit start, check 2hr bst
- y환자는 항혈전,응고제 hv빼면 가능
- d만 트랜자민 1주일 유지
- Fosphenytoin(약명:CERebyx) loading dose(약전에 Kg당 있음) iv Qd *1일->유지용량 iv Qd*1~2일 정도 쓰고 po change(phenytoin 100 mg 1CP Tid or TRIleptal 300 mg Bid) :보통 교수님이 어떻게 주라고 하심
- contrast, Gd ct 찍고나서 mri찍는건 가능
- 튜머 컨퍼

병리과 서유정 1장
방사선종양  이정심  1장
영상의학과 브레인쪽 전공의한테 없으면 교수님  5장정도', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '보호자설명', 'aneurysm 10만명당 9명', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '블럭(block) 준비', '### 경추

MBB: N/S 5 + 리도2% 4 + 트리암 1amp + H-lase 1amp = 10cc / 26G 90mm

FJB: MBB 준비 + 조영제

ESI: N/S 9 + dexa 1 = 10cc, 조영제  / epidural needle + 티포트(ET04TS)

### 요추

MBB: N/S 5 + 리도2% 4 + 트리암 1amp + H-lase 1amp = 10cc / 25G 60mm

FJB: MBB 준비 + 조영제

CB: N/S 9 + dexa 1 = 10cc, 조영제 / 25G 60mm

SNRB: N/S 9 + dexa 1 = 10cc, 조영제, 3cc syringe x 2, epidural needle

### 기타

TPI: N/S 6 + 리도2% 3 (+- dexa 1)', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '사망환자', '- discharge 오더
- 진단서: 선행, 중간, 직접 사인
- 퇴원요약', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '사진', '![1651838058260.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_021.jpg)', '이관' FROM wiki_categories WHERE name = '검사·영상';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '산재신청서', '![1650007350567.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_020.jpg)

![1650007350478.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_019.jpg)', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '수련환경평가', '→ 확인사항

→ 질문', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '수술기록지', '- 날짜
- 환자정보
- preop 진단
- postop 진단
- op name
- op findings - 수술기록지 참고
- 수술방 들어가면 작성
- 조직검사 체크
- 뉴로플라스티는 1년차 잡 문서함에 있음.
- percutanous epidurwl neuroplasty
- balloon이면 그거만 그거으로만 바꿔준다

- 

→ 진단서 & 사본신청', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '수술방 준비', '[블럭(block) 준비](%EB%B8%94%EB%9F%AD(block)%20%EC%A4%80%EB%B9%84%20278eaa4ae6b480448c49fb1809c67ff6.md)

→ burr hole

→ clipping

→ Craniectomy

→ neuroplasty, caudal block

→ TSA

→ OLIF

[TSA(M)](TSA(M)%207c38c2eea58f4d30a4e5c742cc0979f8.md)

[C-post(R)](C-post(R)%2010b266696d834b0da857bb24319f6437.md)

→ PEN

→ IDET

→ ACDF

→ mvd', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '술기복습', '→ EVD bag change

→ CSF lab', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '신경외과', '### **Routine**

---

→ 할일목록!!!!!!!!!!!!!

→ ICU, 병동

→ 잘까먹는 인계사항

→ Dermatome

→ 프리메디

→ 당직표, 외래시간

→ 수술방 준비

→ Post op order

---

- [ ]  화: 의국회의 8시 / 수: vascular, anatomy 7시 / 목: 뇌혈관외과학 7시 / 금: 7시

→ **익일자 CT, MRI 푸쉬했니?**

→ 수련환경평가

### Order

---

---

→ 신환 오더

→ 사망환자

→ 응급실

→ 퇴원

→ GCS

### Rounding

→ 보호자설명

→ 회진 준비

→ P/E

→ 협의진료

→ 술기복습

→ 전과인계

→ 응급수술

### Patient

<aside>
‼️ **응급 op 환자는 피프랩 (anti + NPO 확인도)**

</aside>

→ Cranioplasty

→ Craniotomy

→ Craniectomy

→ SDH

→ ICU 오더

→ ICH

→ Brain tumor

→ Trauma

→ Infarct

→ SAH

→ SPINE- cord

→ Aneurysm, Coil, Stent

### Form

→ 교수님 면허번호

→ Permission

→ Spine noti

→ 수술기록지

→ 연명의료중단

→ 당직표입력

→ 응급실 진료의뢰서

→ mri 급여 인정 서식지

→ 산재신청서

→ 항생제승인지

→ tumor conference

→ 인공호흡기처방전

### Questions

→ 화환신청

→ 질문내용

→ 확인할 내용

→ 공부내용

→ 신경외과 발표자료', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '신경외과 발표자료', '![image.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_083.jpg)

### 종양

1. 종양 선택 indication은?
2. 종합병원급도 취업이 가능한지?
3. 뇌 수술 (종양, 기능 etc) running curve는?, 평균 펠로우 기간?
4. 소송 리스크 상중하?
5. 당직스케쥴, 당직 로딩?
6. 대략적인 페이

### 혈관

1. 혈관 선택 indication은?
2. 종합병원 / 대학병원 대략적인 페이수준: 2.5~3 이상?
3. 당직 스케쥴? 근무강도? : 퐁당퐁당?
4. 소송 리스크 상중하?
5. 취업자리는 꽤 있는지?', '이관' FROM wiki_categories WHERE name = '일정·당직';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '신환 오더', '→ Brain, Spine pts. EM 경유시 서식 끌고오기 가능

→ op 가능성 있는 환자들 : 항응고제 1주일 cut (오팔몬도 출혈 가능성 있어서 끊음)

**→ 70세 이상에선 N/S 500ml, 20cc/hr 로**

**→ 수술환자는 POD#1까지 오더 입력**

→ 수술 당일 pre, post 오더는 처방정렬 하지 않는다

→ POD#1까지 오더 넣는것 잊지말자

# ICU 신환

---

- ICU(adm) 약속처방
- brain 환자는 head 30도 elevation
- 익일 CT f/u 하는지 확인 (추가방, 전체방)
- 혹시 모르니 NPO
- N/S 1000, 40cc/hr
- cerebrolysin 7d, note
- 지혈제 사용하는 pts 는 3d, note

     * 박현선, 김경민, 배진우(B) 교수님은 지혈제 안씀

- tarasyn 으로 pain control
- D 출혈 routine 에 keppra 있음
- muteran : Cr 괜찮으면 300mg, q12hr
→ BUN, Cr 안 좋으면 600mg, q6hr
- 구역, 구토 → nasea

# Spine 신환

---

- COVID 검사부터
- 외래차트 → spine MRI 검사 있는지 확인
- 외부 MRI 들고 온 사람들 reading 오더 넣어야 함
- 수술 날짜 기준 1년 이내 BMD 있어야 함
- ‘Adm (병동)’ 약속처방
- **70세 이상에선 N/S 500ml, 20cc/hr 로**
- **ECG 주말 입원의 경우 (병동용) 으로 check**
- spine Y 약물 약속처방 → BMD 검사 전까지 쭉 (celebrex, lyrica, stillen, nucynta +matok, tra)
- R환자는 pelubi 나이만 잘 챙기자!
- spine MRI 오더 낼 때 (A/A: 급여) 로 수정
→ 외부 영상 있는지 확인, service 컷 까지
- spine flx, ext + ap, lat order
→ **flx, ext x-ray는 myelopathy, Fx. (외래 기록 확인) 일 경우 시행 X (Clx.)
→** compression Fx. 인 경우 AP, lat 도 시행 안한다

<aside>
⚠️ **교수님 별 Spine MRI, CT 시행 유무**

|  | **본원 MRI** | **타병원 MRI** | **본원 CT** | **타병원 CT** | **수술 전 시행 검사** |
| --- | --- | --- | --- | --- | --- |
| **Y** | O | X | X | X | CT: X |
|  | X | O | X | X | CT: O |
|  | X | O | X | O | CT: O |
| R | O |  | X |  | CT: O |
|  | X | O |  |  | CT: O |

### ** MRI 꼭 푸쉬하자!

</aside>

- **CT setting : Y (bone), R (disc)**
- 주말이면 월요일 order 까지 내기
- 입원기록 작성 : 전체서식 → ‘spine 기록지’ → 파란건 다 체크하기
- 전공의 지정
- Lspine 이면 lspine flx ext, ct,mr,t-l spine 4개면 된다
- 

# Brain 신환

---

→ 김환태 2047033

- BR, check io, vs, 주의사항, lipid pannel 기본
- CXR, ECG
- 기본 lab (op 가능성)
- 익일자 “TFCA(시행당일)” 오더
- 스텐트는 당일 prep약물 약속오더

# 전과 온 환자

---

익일 처방 확인, 보통 되어 있다 걱정 ㄴㄴ

<aside>
‼️ **Covid 부터 내자
→ 확진자는 7d 처방 되고, note 작성필요
ICU 월, 목 추가 lab
SI는 자리 prep comment 처방 넣기**

</aside>', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '연명의료중단', '## 환자가 사전에 연명의사가 있을 때

1. 임종과정판단서
2. 연명의료 환자가족진술
(직계 2인 동의, 2인 이상도 가능)
3. 연명의료이행서

## 환자 사전 연명의사 모를 때

1. 임종과정판단서
2. 친권자 및 가족의사확인서
(직계 전원)
3. 연명의료이행서

---

승압제, 투석, 수혈, intu,cpr

의미없는 연명

연명의료 이행서 없이 인공호흡 빼곤 가능

**치매있는 보호자 있는 환자: 치매진단서 있을시 가능**

## 보호자 면담

- 동의서탭으로
- 연명의료 이행서 전공의 작성
- 가족관계증명에 뜨는 모든 가족의 동의
- 인공호흡기 기존것 보호자분과 날짜 맞춰서 뗄 수 있다.
- 날짜가 늦을 시 심폐소생술 상황이 와서 임종을 지키지 못할 수도 있다
- 투석은 이미 하고있어서 하실건지? 비용문제 있다
- 병동에 연락해서 코디네이터 연결해달라고', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '외래 일정표', '![image.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_071.jpg)

![image.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_072.jpg)

![image.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_073.jpg)

![image.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_074.jpg)

![image.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_075.jpg)

![image.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_076.jpg)', '이관' FROM wiki_categories WHERE name = '일정·당직';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '요추후방고정술', '출혈 3%

감염 5%

마비 1%

후궁절제+디스크제거+나사못+봉', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '용법', 'Lyrica

![Untitled](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_061.jpg)', '이관' FROM wiki_categories WHERE name = '약물·처방';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '응급수술', '- 동의서
- 수술예약+약처방
- 마취당직 → 방 확정받기
- 병동 push
- 마취준비실 전화
- OR 인턴 선점하기

피프랩 브레인 10/10

세트라졸 ast확인

수술 약속처방 pre', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '응급실', '문서함 → cva 두번째

skull fracture

![20220409_090852.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_031.jpg)', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '응급실 진료의뢰서', '![20220411_111946.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_035.jpg)

→ <입대오더>', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '익일자 CT, MRI 푸쉬했니', '## 내일 CT

- [ ]  

## 내일 MRI

- [ ]', '이관' FROM wiki_categories WHERE name = '검사·영상';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '인공호흡기처방전', '![Screenshot_20220711-112647_inhaTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_054.jpg)', '이관' FROM wiki_categories WHERE name = 'ICU·병동';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '인체유래물동의서', 'meningioma& sterostatic bx 수술시

1. 유전자검사 동의서
2. 분자병리검사의뢰서
3. 인체유래물기증동의서(병리과용)
4. 인체유래물 기증 동의서(인체유래물 은행용)
5. 유전자 검사 동의서(원내 추가서식)

4, 5 번은 종이서식 필요', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '입대오더', 'v/s q2hr

i/o q4hr

neurology q2hr

n/s 40cc/hr

npo

SMOf 40cc/hr

bp target - 타겟 맞춰서 퍼디핀 5cc증감량

지혈제 B M 안씀 (vitK q6hr+tranexamic acid 2(routine) or 5(S) amp, Qd mix)

tarasyn - cr 수치확인', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '잘까먹는 인계사항', '→ 백업

## 1. **약물 및 투약 관련**

- **NOAC 환자**: PPI 병용
- **Metformin**: POD#2부터 가능, 조영제 사용 시 신기능 주의
- **항경련제**
    - Keppra: 2일 IV 후 PO 변경
    - Fosphenytoin(CERebyx): Loading(kg당 용량) IV QD → 1~2일 유지 IV QD → PO 변경(Phenytoin 100 mg 1T TID or Trileptal 300 mg BID)
    - 알코올 환자: Thiamine 6앰플 루틴, 술 마신 경우 mix
- **진통제**
    - IR Oxycodone PRN, 뉴신타, 타진(발열 시 뉴신타→타진 변경)
    - D는 Tranexamic acid PO 변경, 1주일 유지
- **진정/마취제 용량**
    - Pentothal: kg당 4mg/hr, 100mg 로딩
    - Ketamine: mcg/kg/min
    - Vecuronium: mg/hr
    - Propofol: mg/kg/hr (Propofol 사용 시 TPN 불가)
    - Precedex: mcg/kg/hr
    - Tivare: mcg/kg/min
- **기타**
    - Peridol 0.25앰플, 1시간 간격 최대 3회(QTc 450까지 확인), 아티반 1~2mg IM 병용
    - Phenylephrine 5cc 시작, 최대 40cc
    - Insulin: 1:1 RI, 2U 시작, 2시간마다 BST 체크
    - B교수님: EVD 후 Ceftazidime(세트라졸) 안 씀
    - Stroke 환자: Plasma solution 메인으로
    - ICH 환자: CTA 시 NAVI maker 부착, 빔스크 50mg → 2일 100mg
    - Y환자: 항혈전·항응고제 HV 제거 시 가능
    - cerebrain 세레브레인 1주일, M교수님만 pod3일까지
    - 우리스틴은 icu 1주일, T교수님만
    - 600ml에 20amp 비본-80cchr 로 산증교정안되면 crrt고려

---

## 2. **검사 및 모니터링**

- **B, M**: POD 1, 3, 5만 Kidney panel / 월·목 CBC
- **Swelling 측정**: 2번 4mm, 6번 2cm
- **HMR**: GRE로 확인
- **TTM 시**: ABGA, Electrolyte, CBC, BST q8h
- **Infarct ASPECT score**: 점수 낮을수록 예후 불량
- **스파인 수술 환자**: Mavric view 코멘트 필수(CT·MRI 모두)
- **Perfusion CT**: Acute stroke CT + Perfusion
- **Routine GD MRI**: Brain + DWI (with & without GD)
- NGAL urine높으면 kidney나간거고, plasma가 높으면 infection등 고려

---

## 3. **수술/시술 관련**

- **보조기 착용**
    - L2 이상: TLSO
    - L2 이하: LSO
- **Spine OP + Dual anti**: Refosporen 1V q8h + Amikacin 2V qd
- **S**: Stent 후 TPN 금지, sips → 바로 상식, Voluven 금지
- **만니톨 감량**: 600(100ml) q4h → 1200→900→600→400→200→중단
- **격주 Y·R**: Spine 응급 담당
- **Tlicks**: T/L 판단, Slicks: C op case 판단
- **화요일**: Coil 무조건 첫방
- **R**: 전날 Physical 기록, 전날 첫방 가능 노티
- **B 교수님 Pentothal**: kg당 4mg/hr, 100mg 로딩

---

## 4. **컨퍼런스/보고**

- **판독 Push**: 정호석 선생님 톡
- **NS-RD Conference 메일**:
    - mdcappuccino@daum.net
    - rowoon2@hanmail.net
- **튜머 컨퍼런스**
    - 병리과 서유정 1장
    - 방사선종양 이정심 1장
    - 영상의학과 브레인 전공의(없으면 교수님): 5장 정도

---

## 5. **기타 프로토콜·팁**

- **CVP 목표**: 5~10 mmHg
- **체중 기반 인공호흡기 설정**: 몸무게 × 6 = Tidal volume
- **TPN 대체**: 5% Dextrose 1000ml + PreAmine
- **날록손**: GCS 3-4-6 → 김은경 / 응급실 메모 남기기
- **Waterwall**: OPMVCOPY/ns0328902946
- **Contrast·Gd CT 후 MRI**: 가능

→ dexa tapering 덱사

→ dic, antithrombin

→ refo 신장용량

→ 항응고제 중단시점

→ 턴교대 시간, IA, 당직

→ BIPAP 바이팹, 양압호흡기

→ zoom, 줌 아이디, 화상

→ cefa, cepha, 세파계열 알러지

→ M교수님 몰핀, morphine

→ post-extubation steroid

→ 3제요법', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '전공의 당직표', '![1675345538435.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_024.jpg)', '이관' FROM wiki_categories WHERE name = '일정·당직';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '전과인계', '환자 브리핑

약 뭐쓰는지? 언제까지 쓰는지', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '진단서 & 사본신청', '- 진단서는 **‘최종 진단 + 진단 년월일’** 만 작성
(중환자실 입원기간 포함: “일반 병동에 전실하여 가료 중인 자”)
- 

→ R교수님 진단서

![20220408_092208.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_029.jpg)

![Untitled](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_063.jpg)

- 문서함에 KHS 아래 기본 폼 있음

![image-1649374370024.jpg7171894798000208628.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_077.jpg)

## 사본신청서

보험행정 - 사본신청서

![20220408_104453.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_030.jpg)

## 사망진단서

![20220414_125507.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_036.jpg)', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '질문', '- [ ]  논문 사본, 발표 초록, 이수증은 담당 pa통해?
- [ ]', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '질문내용', '- [ ]  만니톨 tappering?
- [ ]  SIMV mode control
- [ ]  입대 오더 확인하기
- [ ]  사망진단서 컨펌은?
- [ ]  tropin???
- [ ]  BST높은 환자 control, 인슐린 뭘로? 몇 단위?

---

- [ ]  SAH 환자 BP target 160?
- [x]  LPM?? 분당 환기량?
- [ ]  cerebrolysin 변경하는 시점은? 얼마나 사용하는지?
- [x]  Na 교정 안 될 때 3% saline 수치 어느정도 일 때 사용?
- [x]  bst 낮은 환자 50dw 50cc 주면 몇 정도 교정 됨?
- [x]  lactic acid를 따로 교정해주나?
- [x]  Hb 1 pk 당 1교정되면, ex) 8일 때 몇 팩?
- [x]  dehydration 교정은 수액 속도 얼마나 조절?
- [x]  labesin은 BP얼마나 떨굼? bolus로 주나 iv mix로 주나
→ po로는 BP 몇 부터, 뭘, 얼마나 줄까
- [x]  bleeding focus 찾는 건 Hb 몇 부터? 아니면 특정 상황에서?
- [x]  동의서 환자 본인 꼭 필요...?
- [ ]  vanco+tazime 언제 사용?
- [x]  CT recon 필요한 케이스?
- [ ]  

---

- [ ]  프로파 (비급여) vs 데노간 (급여) 적용 기준 다른지
- [ ]  안티복용중인 환자는 fever study 안하나?
- [ ]  3% saline추가하게되면 fluid총량 맞추나? ex) 40→30, 3% 10cc/hr?
- [ ]  urine 300 x2 → DI lab 에서 300은 H/U?
- [ ]  오알인턴확인하는법
- [ ]  마취당직 어케확인하셨나
- [ ]  PEEP 빼면 왜 C 라인 insert 시 좋음?
- [ ]  영양제-클리노 40
- [ ]  칼코즈
- [ ]  놀핀 더블링, 1:1 스타트', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '참고사진', '![Untitled](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_059.jpg)', '이관' FROM wiki_categories WHERE name = '검사·영상';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '추가정정동의서', '![20220410_163740.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_034.jpg)', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '턴교대 시간, IA, 당직', 'vs NR

환자 도착시간 기준 7am

혈촬실은 8am 턴교대

pa샘들은 6am

교수님당직은 6am', '이관' FROM wiki_categories WHERE name = '일정·당직';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '퇴원', '- x-ray 확인
- 수술기록 확인
- 퇴원요약
- 퇴원약', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '표', '![Untitled](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_062.jpg)', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '프리메디', '- **의식수준 alert drowsy stupor +@(GCS, HHS)**
- **왜하는지**
- **키 몸무게**
- 치아상태
- 기저질환
- **엔피오**
- **covid 기확진자?**
- **intu상태**
- **라인 몇개?**
- **약**
- BP(퍼디핀, 놀핀 등)
-세데이션(바스캄, 티바레, 프로포폴)
- **op계획**
- **언제할건지**', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '할일목록!!!!!!!!!!!!!', '## 액팅

- [x]  **수술기록지**
- [ ]  **ICU 자리 프렙**
- [ ]  **CT push**
- [x]  **협진환자 챙기기**
- [ ]  **POD#1, 3, 5일 랩**
- [x]  **퇴원설명**
- [x]  리리카-뉴신타-타진
- [x]  전공의 공통역량교육
- [x]  심세권 상병 마이엘로페씨
- [ ]  당직표입력
- [ ]  워싱턴준비
- [x]  m 세레브로리진 용법
- [ ]  튜머컨퍼 20일로 수정됨 화요일
- [ ]  월요일 김지연 인계
- [ ]  소득금액증명원,자격득실확인서
- [ ]  

- [x]  서동일랩교정
- [ ]  권춘화 id회신
- [x]  이상옥 협진작성
- [x]  이상희 엠알푸시
- [ ]  유재순 진단서
- [ ]  

## 드레싱

- [ ]  

## ct 노티

- [ ]', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '항생제승인지', '![20220402_075348.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_028.jpg)', '이관' FROM wiki_categories WHERE name = '약물·처방';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '항응고제 중단시점', '![20230114_155346.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_044.jpg)', '이관' FROM wiki_categories WHERE name = '약물·처방';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '혈관촬영실', '![Screenshot_20220802-014118_KakaoTalk.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_057.jpg)

![1659372082966.jpg](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_023.jpg)', '이관' FROM wiki_categories WHERE name = '수술·시술';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '협의진료', '# Cardio

---

### TTE + holter', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '화환신청', '교실이름으로 보낼때
삼가고인의 명복을 빕니다 인하대병원 신경외과학교실 일동

![1649406216602.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_017.jpg)

![1649406216554.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_016.jpg)

![1649406216494.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_015.jpg)

![1649406472380.png](https://stiqfkimxkneoivyqaov.supabase.co/storage/v1/object/public/wiki-images/wiki_018.jpg)', '이관' FROM wiki_categories WHERE name = '행정·서류';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '확인사항', '- [ ]  전공의 수첩

 - 과장님이 풀어줘야해서 마지막에

- [ ]  과내 원내 학술집담회 기록
- [ ]  논문(사본)/발표(초록) 증빙자료
- [ ]  수술분류
- 클릭선택 의사
- 기록지랑
- 최종작성의-교수님도상관없
- [ ]  
- [ ]  지도전문의 2023 연말정산서 또는 급여지급명세서 또는 건강보험 납부확인서

교수님별로 이수증

- [ ]  전공의 수련계획서
- [ ]  전문의/전공의 조사표(엑셀)
- [ ]  ct mri 3층재활검사실 확인 장비list
- [ ]  유관학회에 032포함?? 안했던거같다 다른병원 확인
- [ ]  

---

컨퍼지

수술분류 배분

수술기록지확인

수련계획서', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '확인할 내용', '- [ ]  Y 약 : tra...? mag....? 심할 경우 주는 약
- [ ]  PO2 target?
- [ ]  보조기 TLSO
- [ ]', '이관' FROM wiki_categories WHERE name = '신환·인계';
INSERT INTO wiki_documents (category_id, title, content, created_by) SELECT id, '회진 준비', '## Lab(Na/K), I/O(배액, evd, hvac 포함, 2~3d), V/S (SBP, BT)
mental, pupil (활동신체), neurology

- POD #1 인 경우 모든 상황 다 noti
- EVD 있는지 (I/O) 확인, 있다면 **높이, 양** 체크
- v/s → fever 있는지, BP broad하게 기록
- i/o 확인하고 전날과 balance 맞추기 (2~3일치 확인)
- 진료기록에서 신규 lab (파란색) 확인
- **B, M은 GCS 물어보심**
-', '이관' FROM wiki_categories WHERE name = '일정·당직';