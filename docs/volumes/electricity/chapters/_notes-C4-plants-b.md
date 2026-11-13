# Notes — C4-plants-b (plant-wind, plant-solar, plant-geo-bio, plant-ocean, plant-future)

> **Статус (E1-reconcile, листопад 2026 р.).** Це робочі нотатки автора на момент здачі чернеток; після рецензій
> R1–R11 та узгодження чинними є документи розділів, `docs/DECISIONS.md`, `docs/GLOSSARY.md`,
> `docs/chapters/INDEX.md` і `docs/chapters/_shared-house.md`. Якщо нотатки їм суперечать — нотатки застаріли.
> Зокрема замінено: §2: терміни FCR/aFRR → «резерв підтримання частоти (FCR)», BESS → «СНЕ», «мережоутворювальний» → «мережоформувальний» (§22, §34), «паливний елемент» → «паливна комірка» (§27), AVR → «автоматичний регулятор напруги» (§19), «рядний інвертор» → «стрінговий» (§25), «амплітуда припливу» → «величина припливу» (§40); акцент `sky` у ВЕС не замінює `plantType.wind` = `teal` на діаграмах (§29).

Fact-check date: 2026-11-13. All volatile facts carry a year in the chapter text and a source in each chapter's
«Примітки щодо фактів».

## 1. Corrections / refinements to CURRICULUM.md

| Chapter | CURRICULUM says | Correction / refinement | Reason |
|---|---|---|---|
| plant-wind | «offshore 15+ MW (ротор 220–240 m)» | Serial offshore = 15 MW / 236 m (Vestas V236, installed at sea from 2025); prototypes 20–26 MW with rotors 260–310 m (Dongfang 26 MW, 2025); a 20 MW / ~300 m unit grid-connected at sea in China (Feb 2026) | records moved |
| plant-wind | «генератор (DFIG)» listed as the generator | DFIG is one of three drivetrain families (DFIG+gearbox, direct-drive PMSG, medium-speed PMSG) — step `drivetrain` compares all three | DFIG no longer dominant offshore |
| plant-wind | «cut-in ~3, rated ~12, cut-out ~25 m/s» | rated 10–13 m/s (modern low-specific-power rotors ~10–11); many turbines use storm control (soft ramp-down to 30–35 m/s) instead of hard cut-out | modern practice |
| plant-solar | «CF 12–25 %» | «10–25 %», with a note that it depends on DC vs AC basis; IRENA 2024 global average for new utility PV = 17,4 % | definitional ambiguity |
| plant-solar | CSP «dish Stirling» on equal footing | presented as non-commercial (record 31,25 % but ~25 kW units); Ivanpah closure (2026) noted | market reality |
| plant-geo-bio | — | added EGS step with Fervo Cape Station (first 33 MW grid-synced 24.09.2026) and induced-seismicity cases (Basel 2006, Pohang 2017) | new milestone |
| plant-ocean | «OTEC, salinity gradient (згадка)» | kept as a short step with an honest Carnot argument; Statkraft PRO (2009–2013) and Makai 100 kW (2015) | — |
| plant-future | «fusion … inertial (NIF, 2022)» | added NIF 8,6 MJ / gain 4,13 (07.04.2025); ITER 2024 baseline (SRO 2034, D–T 2039); JET 69 MJ (2023/24); SPARC first plasma target 2027 | newer milestones |
| plant-future | «BESS (LFP-контейнери + PCS + трансформатор, grid-forming)» | expanded to two steps (hardware; grid services incl. frequency simulation) + Ukrainian BESS 2025 | pedagogy |

No CURRICULUM number in my chapters was found to be outright wrong; the main issue is staleness of records.

## 2. Terminology decisions (Ukrainian equivalents)

- **gearbox (wind)** → «мультиплікатор» (step-up gear; «редуктор» reduces speed, so it is wrong here).
- **hub** → «маточина»; **nacelle** → «гондола»; **blade** → «лопать» (pl. «лопаті»); **swept area** → «площа ротора (ометувана площа)».
- **tip speed ratio** → «швидкохідність λ» (standard Ukrainian/Soviet wind-engineering term).
- **wake** → «аеродинамічний слід» (colloquial «вітрова тінь» given once).
- **monopile** → «моноплаля (монопаля)»; **jacket** → «ґратчаста основа (jacket)».
- **capacity factor** → «КВВП» (коефіцієнт використання встановленої потужності) — same as hub.
- **tide** → «приплив і відплив»; adjective consistently **«припливний»** (припливна гребля, припливна сила, припливні течії), matching normative «приплив». ПЕС = припливна електростанція.
- **spring / neap tide** → «сизигійний / квадратурний приплив».
- **irradiance / irradiation** → «опроміненість (G, W/m²) / опромінення, інсоляція (H, kWh/m²)».
- **string** → «стрінг» (transliteration is established in Ukrainian PV practice), with «послідовний ланцюжок модулів» at first mention.
- **combiner box** → «з'єднувальна (комбінувальна) скриня».
- **clipping** → «зрізання піку»; **curtailment** → «обмеження генерації».
- **digester** → «метантенк»; **digestate** → «дигестат»; **HRT** → «час перебування».
- **WtE** → «енергетична утилізація відходів», plant = «сміттєспалювальна ТЕЦ»; **MSW** → «ТПВ».
- **genset** → «генераторна установка (генератор)»; **ATS** → «АВР (автоматичне введення резерву)»; **AVR** → «автоматичний регулятор напруги».
- **BESS** → «система накопичення енергії на акумуляторах»; **PCS** → «система перетворення енергії (двонапрямний інвертор)».
- **FCR / aFRR** → «резерв підтримки частоти / автоматичний резерв відновлення частоти» (ENTSO-E terms as used by «Укренерго»); **UFLS** → «АЧР».
- **hohlraum** → «хольраум»; **blanket** → «бланкет»; **divertor** → «дивертор».
- Proper names transliterated per current Ukrainian practice: Ла-Ранс, Сіхва, Лардерелло, Гейзерс, Гедлісгейді, П'єро Джинорі Конті, Пхохан, Тилігульська ВЕС.

## 3. Cross-chapter dependencies

- **Hub `plants` (C3-plants-a):** my chapters refer to the hub for Carnot limit, Rankine/Brayton, steam island, capacity factor (КВВП), LCOE and lifecycle CO₂. Please make sure the hub defines these. I used «хаб «Електростанції»» in copy (no hub step ids yet — builder should link to the hub's metrics step once its id is known). CO₂ comparisons in `plant-geo-bio` M6b use CCGT 350–490 and coal 820–1000 g/kWh — same ranges as CURRICULUM for the hub.
- **`plant-hydro` (C3):** `plant-ocean` step `barrage` reuses `P = η·ρ·g·Q·H` and «капсульна турбіна» — please keep the same term for bulb turbine.
- **`generator-ac`, `transformer`, `transmission` (C2):** referenced for synchronous generator, `n = 60·f/p`, transformers, HVDC offshore links (wind step `offshore`).
- **`grid` (C5):** duck curve appears both in `plant-solar` (step `duck-curve`, plant-level, with a model) and in `grid` step 9 — C5 may reuse my M5 load profile for consistency. `plant-future` step `bess-services` has a single-area frequency model (S = 20 GW, H = 4 s, ΔP = 1 GW, АЧР threshold 49,0 Hz): C5's frequency model should agree qualitatively (thresholds, ±0,05 Hz normal band, FCR full activation at 200 mHz in ≤ 30 s).
- **Labs (C6):** `lab-pv` — cell physics, STC, string sizing with cold V_oc, degradation (I only reference these). `lab-inverter` — H-bridge/PWM, MPPT, grid-forming (referenced from wind `drivetrain`, solar `inverter-station`, future `bess`). `lab-battery` — LFP chemistry, BMS, thermal runaway (referenced from `bess`). `lab-hybrid-home` — ATS/UPS switching times (referenced from `gensets`).

## 4. Facts likely to go stale (re-check before release)

- Wind: global totals (GWEC 2026: 1299 GW, +165 GW), turbine records (26 MW / 310 m), Hornsea 2 vs Dogger Bank, Tyligulska phase II (target end-2026), Ukrainian wind capacity.
- Solar: global PV (~3 TW, +650–700 GW in 2025), largest PV plant (Midong 3,5 GW?), CSP total (~7–8 GW — weakly sourced), Ivanpah closure, Ukrainian PV (>8,5 GW), California battery fleet (>10 GW).
- Geo/bio: geothermal 17 173 MW (end-2025), Fervo Cape Station phases, Kenya share, Ukrainian biogas (140 MW_el) and Teofipol biomethane dates.
- Ocean: MeyGen cumulative GWh, CorPower/Eco Wave Power status, global ocean capacity (~0,5 GW).
- Future: NIF record yield, ITER schedule, SPARC first plasma, EAST/WEST/W7-X records, largest BESS/electrolyzer, Ukrainian BESS totals, Voyager RTG power.

## 5. Open questions / weakly verified

- Global CSP capacity (≈7–8 GW) — no fresh primary source found; estimate.
- Kenya geothermal installed MW — sources conflict (≈0,83–1,0 GW).
- 20 MW offshore turbine grid-connection (Feb 2026) — single news source.
- Black Sea wave power (~2–5 kW/m) — literature range, sources differ.
- Pokrovska SES 240 MW (DTEK, 2019) and Kyiv «Енергія» WtE start year — from general knowledge, not re-verified online in this session.
- Cumulative global grid BESS (BNEF 307 GW / 747 GWh vs Rystad >250 GW) — scope differences.
- Simulation models are deliberately simplified; each is labelled «спрощена/ілюстративна модель» where it is qualitative (wake steering, EGS seismicity, carbon debt, buoy resonance, NIF curve).
