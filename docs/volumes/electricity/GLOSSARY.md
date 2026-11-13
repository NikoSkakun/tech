# GLOSSARY — єдиний глосарій тому «Електроенергія» (згенеровано)

> Файл генерує `tools/content/build_glossary.py` з таблиць «Глосарій розділу» всіх документів
> `docs/volumes/electricity/chapters/<id>.md` — **не редагувати вручну**: правте глосарій розділу й перегенеруйте.
> Правило термінів (CURRICULUM, DECISIONS §3): міжнародний термін — перший, український відповідник — поруч;
> позначення й одиниці — міжнародні. Визначення й місце введення взято з першого за порядком подорожі розділу.

Термінів: **684** (з 773 рядків глосаріїв 25 розділів).

| International | Українською | Позначення | Одиниця | Визначення | Вводиться (розділ/крок) | Також у розділах |
|---|---|---|---|---|---|---|
| ABC (aerial bundled cable) | СІП, самоутримний ізольований провід | — | — | Скручений джгут ізольованих жил. | `distribution/lv-network` | — |
| AC (alternating current) | змінний струм | ~ | A | Струм, що періодично змінює напрям. | `generator-ac/ac-anatomy` | — |
| ACSR | сталеалюмінієвий провід (АС) | — | — | Al-повиви на сталевому осерді. | `transmission/line-anatomy` | — |
| Active power | активна потужність | P | W | Середня корисна потужність. | `generator-ac/ac-power` | — |
| Active / reactive power | активна / реактивна потужність | P, Q | W, var | корисна / обмінна потужність | `lab-inverter/grid-tie` | — |
| AEP | річний виробіток | AEP | MWh | Енергія, вироблена за рік | `plant-wind/capacity-factor` | — |
| aFRR | автоматичний резерв відновлення частоти (аРВЧ) | — | MW | Повертає частоту до 50 Hz за хвилини | `grid/reserves` | — |
| Air density | густина повітря | ρ | kg/m³ | Маса одиниці об’єму повітря | `plant-wind/wind-power` | — |
| Air mass | оптична маса атмосфери | AM | — | Відносна довжина шляху променя крізь атмосферу | `plant-solar/sunlight` | `lab-pv` |
| Air preheater | повітропідігрівник | — | — | Гріє повітря для горіння. | `plant-coal/boiler` | — |
| Albedo | альбедо | ρ_g | — | Відбивна здатність поверхні | `plant-solar/trackers` | — |
| Alternator | альтернатор | — | — | Синхронний генератор малої потужності | `plant-future/gensets` | — |
| Ampère force | сила Ампера | F | N | F = B·I·L·sin α. | `magnetism/lorentz` | — |
| Ampacity | допустимий тривалий струм | I_доп | A | Струм без перегріву. | `transmission/sag-thermal` | — |
| Ampere | ампер | A | A | 1 A = 1 C/s. | `current/current` | — |
| Amplitude (peak) | амплітуда | U_max, I_max | V, A | Найбільше миттєве значення. | `generator-ac/ac-anatomy` | — |
| Anaerobic digestion | анаеробне зброджування | — | — | Розкладання органіки мікроорганізмами без кисню | `plant-geo-bio/biogas` | — |
| Angle of attack | кут атаки | α | ° | Кут між хордою профілю і уявним вітром | `plant-wind/blade` | — |
| Angular frequency | кутова частота | ω | rad/s | ω = 2πf. | `generator-ac/rotating-loop` | — |
| Anode / Cathode | анод / катод | −, + | — | електроди (назви — за режимом розряду) | `lab-battery/what-is-battery` | — |
| Anti-islanding, loss of mains (LoM) | захист від острівного режиму | — | s | відключення при зникненні мережі (≤ 2 s) | `lab-inverter/grid-tie` | — |
| Apparent power | повна потужність | S | VA | S = U·I. | `generator-ac/ac-power` | — |
| ARC | антивідбивне покриття | — | — | плівка, що зменшує відбиття | `lab-pv/cell` | — |
| Atom | атом | — | — | Найменша частинка хімічного елемента: ядро + електрони. | `atom/dive-in` | — |
| Atomic number | атомний номер (зарядове число) | Z | — | Кількість протонів у ядрі. | `atom/nucleus` | — |
| ATS | автоматичне введення резерву (АВР) | — | — | Перемикач між мережею й резервом | `plant-future/gensets` | `home`, `lab-hybrid-home` |
| Attenuator | атенюатор | — | — | Довгий шарнірний пристрій уздовж хвилі | `plant-ocean/wave-devices` | — |
| Auto-reclosing | АПВ (автоматичне повторне вмикання) | — | — | Повторне вмикання після паузи. | `transmission/protection` | — |
| Autotransformer | автотрансформатор | — | — | Обмотки зі спільною частиною. | `transformer/types` | — |
| AVR | автоматичний регулятор напруги (у великій енергетиці — АРЗ) | — | — | Підтримує напругу генератора. | `generator-ac/synchronous-generator` | `plant-future` |
| AVR (у ДБЖ) | автоматичне регулювання напруги | — | — | стабілізація напруги автотрансформатором | `lab-inverter/ups` | — |
| Axial induction factor | коефіцієнт осьової індукції | a | — | Відносне сповільнення вітру в площині ротора | `plant-wind/betz` | — |
| Back EMF | проти-ЕРС | ℰ_b | V | ЕРС обертового двигуна, спрямована проти напруги живлення. | `magnetism/dc-motor` | — |
| Back-to-back | вставка постійного струму | — | — | Зв’язок несинхронних систем. | `transmission/hvdc` | — |
| Backfeed | зворотне живлення мережі | — | — | Небезпечна подача напруги з дому в мережу | `home/backup` | `lab-hybrid-home` |
| Backtracking | зворотне відстеження | — | — | Обмеження кута трекерів для уникнення затінення | `plant-solar/trackers` | — |
| Backup reserve | резерв заряду | — | % | рівень заряду, нижче якого батарея не розряджається при мережі | `lab-hybrid-home/evening-night` | — |
| Balancing market | балансуючий ринок (БР) | — | — | Врегулювання небалансів у реальному часі | `grid/markets` | — |
| Band gap | заборонена зона (її ширина) | E_g | eV | Проміжок без станів між зонами. | `matter/bands` | `lab-pv` |
| Battery pack | батарея (збірка) | sS·pP | — | комірки, з’єднані послідовно/паралельно | `lab-battery/pack` | — |
| BECCS | біоенергетика з уловлюванням та зберіганням вуглецю | — | — | Спалювання біомаси з уловлюванням і захороненням CO₂ | `plant-geo-bio/carbon` | — |
| BESS | акумуляторна система накопичення енергії (СНЕ) | — | MW, MWh | Акумуляторна «електростанція» | `plant-future/overview` | `grid`, `lab-battery` |
| Betz limit | межа Беца | — | — | Максимум C_p = 16/27 ≈ 0,593 для відкритого ротора | `plant-wind/betz` | — |
| Bifacial module | двосторонній модуль | — | — | Модуль, що приймає світло обома сторонами | `plant-solar/trackers` | — |
| Binary cycle (ORC) | бінарний цикл (органічний цикл Ренкіна) | — | — | Тепло розсолу передається робочому тілу з низькою t° кипіння | `plant-geo-bio/geo-plant-types` | — |
| Biofouling | біологічне обростання | — | — | Наростання водоростей і мушель на конструкціях | `plant-ocean/survival` | — |
| Biogas | біогаз | — | m³ | Суміш CH₄ (50–70 %) і CO₂ | `plant-geo-bio/overview` | — |
| Biogenic carbon | біогенний вуглець | — | — | Вуглець, нещодавно поглинутий рослинами | `plant-geo-bio/carbon` | — |
| Biomass | біомаса | — | — | Органічна речовина рослинного/тваринного походження | `plant-geo-bio/overview` | — |
| Biomethane | біометан | — | m³ | Очищений біогаз, ≥ 95 % CH₄ | `plant-geo-bio/biogas-chp` | — |
| Bipole | біполь | ±U | kV | Два полюси «+» і «−». | `transmission/hvdc` | — |
| Black start | пуск «з нуля» | — | — | Пуск без зовнішнього живлення для відновлення системи. | `plants/flexibility` | `plant-future`, `grid` |
| Blackout | блекаут (системна аварія) | — | — | Повне знеструмлення частини або всієї системи | `grid/blackouts` | — |
| Blanket / Divertor | бланкет / дивертор | — | — | Поглинання нейтронів і виробництво T / відведення тепла й гелію | `plant-future` | — |
| BMS | система керування батареєю | — | — | моніторинг, захист, балансування, зв’язок | `lab-battery/voltage-capacity` | — |
| BMS / EMS | система керування батареєю / енергією | — | — | Захист комірок / вибір режимів роботи | `plant-future` | — |
| Body impedance | опір тіла | Z_T | Ω | Опір тіла людини проходженню струму | `home/shock` | — |
| Boiler feed pump | живильний насос | — | MW | Подає воду в котел під повним тиском. | `plant-coal/feedwater` | — |
| Boost converter | підвищувальний перетворювач | D | — | перетворювач постійної напруги, що її підвищує | `lab-inverter/dc-link` | — |
| Boson / fermion | бозон / ферміон | — | — | Переносник взаємодії (цілий спін) / частинка речовини (спін ½). | `atom` | — |
| Bottom ash / fly ash | шлак / летка зола | — | t | Тверді залишки спалювання | `plant-geo-bio` | — |
| Brayton cycle | цикл Брайтона | — | — | Газотурбінний цикл: стиснення, згоряння, розширення. | `plants/brayton` | — |
| Breaking capacity | комутаційна здатність | Icn | A | Найбільший струм КЗ, який автомат вимкне | `home/mcb` | — |
| Breather | повітроосушувач | — | — | Осушує повітря, що «вдихає» розширювач. | `transformer/anatomy` | — |
| Brine | геотермальний розсіл | — | — | Мінералізована вода з резервуара | `plant-geo-bio/geo-plant-types` | — |
| Broken neutral | обрив («відгоряння») нейтралі | — | — | Втрата нейтралі → перекіс напруг. | `distribution/neutral-earthing` | — |
| Brush | щітка | — | — | Ковзний графітовий контакт. | `magnetism/dc-motor` | — |
| Buchholz relay | газове реле (Бухгольца) | — | — | Захист від внутрішніх пошкоджень. | `transformer/anatomy` | — |
| Built-in voltage | контактна різниця потенціалів (вбудована напруга) | V_bi | V | Бар’єр переходу в рівновазі. | `matter/pn-junction` | `lab-pv` |
| Bulb turbine | капсульна турбіна | — | — | Горизонтальна турбіна з генератором у капсулі в потоці | `plant-ocean/barrage` | — |
| Bundled conductor | розщеплена фаза | — | — | Кілька проводів у фазі. | `transmission/line-anatomy` | — |
| Burnup | глибина вигоряння | BU | MWd/kgU | Енергія з кілограма урану. | `plant-nuclear/fuel` | — |
| Busbar | збірні шини | — | — | Спільні провідники РП. | `transmission/substation` | — |
| Bushing | ввід (прохідний ізолятор) | — | — | Ізольований вихід струмоводу з бака. | `transformer/anatomy` | — |
| Bypass diode | обхідний діод | — | — | діод в обхід затіненої секції | `lab-pv/module` | — |
| C-rate | кратність струму | C | 1/h | струм відносно ємності | `lab-battery/voltage-capacity` | — |
| Calendar / cycle aging | календарне / циклічне старіння | — | — | старіння з часом / від циклів | `lab-battery/degradation` | — |
| Capacitance | ємність | C | F | `C = Q/U`. | `charge-field/capacitor` | — |
| Capacitor | конденсатор | — | — | Дві провідні обкладки, розділені діелектриком. | `charge-field/capacitor` | — |
| Capacity | ємність | Q | Ah | заряд, який віддає акумулятор | `lab-battery/voltage-capacity` | — |
| Capacity factor | КВВП, коефіцієнт використання встановленої потужності | CF | % | Річний виробіток / (P_inst · 8760 h). | `plants/metrics` | `plant-wind` |
| Carbon debt | вуглецевий борг | — | t CO₂ | Тимчасовий надлишок CO₂ в атмосфері від спалювання біомаси | `plant-geo-bio/carbon` | — |
| Carnot efficiency | ККД Карно | η_C | % | Теоретична межа ККД теплового двигуна: `1 − T_c/T_h`. | `plants/heat-engine` | — |
| Carrier | несуча | f_c | Hz | трикутний сигнал високої частоти | `lab-inverter/pwm` | — |
| Cavitation | кавітація | — | — | Утворення і змикання парових бульбашок. | `plant-hydro/water-path` | — |
| CC/CV | заряд сталим струмом / напругою | — | — | стандартний алгоритм заряду літій-іонних акумуляторів | `lab-battery/charging` | — |
| CCGT (combined-cycle gas turbine) | парогазова установка (ПГУ) | ПГУ | — | ГТ + котел-утилізатор + парова турбіна. | `plants/heat-engine` | `plant-gas` |
| CCS | уловлювання та зберігання вуглецю | — | — | Відділення й закачування CO₂ у пласти. | `plant-coal/ash-co2` | — |
| Cell balancing | балансування комірок | — | A | вирівнювання рівня заряду комірок | `lab-battery/bms` | — |
| Chain reaction | ланцюгова реакція | — | — | Самопідтримний ланцюг поділів. | `plant-nuclear/chain-reaction` | — |
| Charging current | зарядний (ємнісний) струм | I_C | A | Струм перезаряджання ємності лінії. | `transmission/cables` | — |
| CHP | когенерація (ТЕЦ) | — | — | Спільне вироблення електроенергії й тепла. | `plant-coal/chp-flex` | `plant-geo-bio` |
| CID / PTC / Vent | переривач струму / термістор-шайба / клапан | — | — | вбудовані захисти комірки | `lab-battery` | — |
| Circuit | електричне коло | — | — | Замкнений шлях для струму. | `current/circuit` | — |
| Circuit breaker | вимикач | — | — | Вимикає струми КЗ. | `transmission/substation` | — |
| Clearance | габарит | — | m | Мінімальна відстань до землі/об’єктів. | `transmission/sag-thermal` | — |
| Clipping | зрізання піку | — | — | Обмеження потужності інвертором на рівні його номіналу | `plant-solar/inverter-station` | — |
| Collector system | збірна мережа | — | kV | Кабельна мережа між турбінами і підстанцією ВЕС | `plant-wind/wind-farm` | — |
| Color charge | кольоровий заряд | — | — | «Заряд» сильної взаємодії, три види. | `atom/quarks` | — |
| Colour temperature (CCT) | колірна температура | — | K | Відтінок білого світла | `home/lighting` | — |
| Combined cycle | комбінований цикл | — | — | Цикл Брайтона + цикл Ренкіна. | `plant-gas/combined-cycle` | — |
| Combiner box | з’єднувальна скриня | — | — | Паралельне з’єднання ланцюжків модулів із захистом | `plant-solar/dc-array` | — |
| Commutator | колектор | — | — | Перемикач напряму струму в роторі. | `magnetism/dc-motor` | — |
| Concentration ratio | коефіцієнт концентрації | C | — | У скільки разів зростає густина потоку світла | `plant-solar/csp-types` | — |
| Condenser | конденсатор | — | — | Теплообмінник, де відпрацьована пара стає водою. | `plants/rankine` | `plant-coal` |
| Conductance | провідність | G | S | `G = 1/R`. | `current/ohm` | — |
| Conduction band | зона провідності | E_c | eV | Зона, де електрони вільно рухаються. | `matter/bands` | — |
| Confinement | конфайнмент | — | — | Неможливість існування вільних кварків. | `atom/quarks` | — |
| Conservation of charge | закон збереження заряду | — | — | Сума зарядів замкненої системи стала. | `charge-field/charge` | — |
| Conservator | розширювач | — | — | Бак для теплового розширення оливи. | `transformer/anatomy` | — |
| Containment | захисна оболонка | — | — | Герметична оболонка навколо реактора. | `plant-nuclear/safety` | — |
| Contracted capacity | дозволена (договірна) потужність | P | kW | Обмеження ввідним автоматом. | `distribution/service-entrance` | — |
| Control rod | регулювальний стрижень | — | — | Поглинач нейтронів для керування. | `plant-nuclear/control` | — |
| Conventional current | умовний напрям струму | — | — | Від «+» до «−» у зовнішньому колі. | `current/current` | — |
| Converter station | перетворювальна станція | — | — | Змінний струм ↔ постійний. | `transmission/hvdc` | — |
| Cooling tower | градирня | — | — | Споруда для відведення тепла в повітря випаровуванням. | `plants/steam-island` | — |
| Corona discharge | коронний розряд | — | — | Світіння повітря біля вістря в сильному полі. | `charge-field/conductor-in-field` | `transmission` |
| Coulomb | кулон | C | C | 1 C = 1 A·s ≈ 6,24×10¹⁸ e. | `charge-field/charge` | — |
| Coulomb constant | стала Кулона | k | N·m²/C² | 8,988×10⁹ N·m²/C². | `charge-field/coulomb` | — |
| Coulomb’s law | закон Кулона | F | N | `F = k·|q₁q₂|/r²`. | `charge-field/coulomb` | — |
| Critical loads panel | щит критичних навантажень | — | — | щит, що живиться від резервного виходу | `lab-hybrid-home/overview` | — |
| Critical point | критична точка | — | MPa, °C | 22,064 MPa; 373,95 °C. | `plant-coal/steam-params` | — |
| Cross-section | переріз | A | mm² | Площа поперечного перерізу жили | `home/wiring` | — |
| Crystal lattice | кристалічна ґратка | — | — | Періодичне розташування атомів. | `matter/lattice` | — |
| CSP | концентрована сонячна теплова енергетика | — | — | Отримання тепла концентрованим світлом і перетворення його на електрику турбіною | `plant-solar/overview` | — |
| CT | трансформатор струму («кліщі») | — | A | Вимірювальний, вторинний струм 1/5 A. | `transformer/types` | `lab-hybrid-home` |
| Curie temperature | точка Кюрі | T_C | °C, K | Межа втрати феромагнетизму (Fe — 770 °C). | `magnetism/domains` | — |
| Current-carrying capacity | тривало допустимий струм | I_z | A | Струм без перегріву ізоляції | `home/wiring` | — |
| Current density | густина струму | J | A/m² | `J = I/A`. | `current/drift` | — |
| Curtailment | обмеження генерації | — | MW, kWh | Примусове зниження видачі за командою оператора | `plant-solar/substation-control` | `lab-hybrid-home` |
| Cut-in / rated / cut-out speed | швидкість увімкнення / номінальна / вимкнення | v_in, v_r, v_out | m/s | Характерні точки кривої потужності | `plant-wind` | — |
| Dam | гребля | — | — | Споруда, що створює напір. | `plant-hydro/overview` | — |
| Day-ahead market | ринок «на добу наперед» (РДН) | — | €/MWh, грн/MWh | Аукціон на кожну годину наступної доби | `grid/markets` | — |
| DC / AC | постійний / змінний струм | — | — | Незмінного / змінного напрямку. | `current` | — |
| DC/AC coupling | зв’язок по постійному / змінному струму | — | — | спосіб підключення батареї до системи | `lab-hybrid-home` | — |
| DC/AC ratio | коефіцієнт перевантаження інвертора | DC/AC | — | Відношення потужності модулів до потужності інверторів | `plant-solar/inverter-station` | — |
| DC (direct current) | постійний струм | = | A | Струм незмінного напряму. | `generator-ac/ac-anatomy` | — |
| DC isolator | роз’єднувач постійного струму | — | — | апарат для вимкнення постійного струму під навантаженням | `lab-pv/array` | — |
| DC link | ланка постійного струму | U_dc | V | конденсаторна шина постійної напруги | `lab-inverter/why-inverter` | — |
| DC motor | двигун постійного струму | — | — | Перетворює енергію постійного струму на механічну. | `magnetism/dc-motor` | — |
| Dead time | мертвий час | t_d | μs | пауза між вимиканням і вмиканням ключів стійки | `lab-inverter/h-bridge` | — |
| Deaerator | деаератор | — | — | Видаляє розчинений кисень. | `plant-coal/feedwater` | — |
| Decay heat | залишкове тепловиділення | P_d | MW, % | Тепло розпаду після зупинки. | `plant-nuclear/safety` | — |
| Defence in depth | глибокоешелонований захист | — | — | Кілька незалежних рівнів захисту. | `plant-nuclear/safety` | — |
| Delayed neutrons | запізнілі нейтрони | β (частка) | — | Нейтрони, що вилітають із затримкою в секунди; їхня частка β ≈ 0,65 %. | `plant-nuclear/control` | — |
| Delta | трикутник | Δ | — | З’єднання обмоток у кільце. | `generator-ac/star-delta` | — |
| Demand response | керування попитом | — | MW | Зміна споживання у відповідь на сигнал системи | `grid/dispatcher` | — |
| Depletion region | збіднена область | W | μm | Шар без вільних носіїв біля переходу. | `matter/pn-junction` | `lab-pv` |
| DER | розподілені енергоресурси | — | — | Дрібна генерація й накопичення. | `distribution/der` | — |
| DETC | ПБЗ, перемикання без збудження | — | — | Перемикач відгалужень на вимкненому трансформаторі. | `transformer/tap-changer` | — |
| DFIG | асинхронний генератор подвійного живлення | — | — | Генератор зі статором на мережі й ротором через перетворювач | `plant-wind/drivetrain` | — |
| Dielectric breakdown | електричний пробій | E_b | V/m | Втрата ізолювальних властивостей у сильному полі. | `charge-field/static` | — |
| Dielectric strength | електрична міцність | E_b | kV/mm | Поле, за якого настає пробій. | `matter/insulators` | — |
| Digestate | дигестат | — | t | Зброджений залишок, добриво | `plant-geo-bio/biogas` | — |
| Digester | метантенк | — | m³ | Реактор для зброджування | `plant-geo-bio/biogas` | — |
| Diode | діод | — | — | Прилад з однобічною провідністю. | `matter/pn-junction` | — |
| Dipole | диполь | p | C·m | Пара рівних різнойменних зарядів. | `charge-field/field` | — |
| Direct drive | прямий привод | — | — | Генератор на валу ротора без мультиплікатора | `plant-wind/drivetrain` | — |
| Disconnector | роз’єднувач | — | — | Видимий розрив без струму. | `transmission/substation` | — |
| Dispatchability | диспетчеризованість | — | — | Здатність змінювати потужність за командою. | `plants/flexibility` | — |
| Distributed generation | розподілена генерація | — | — | Багато малих джерел біля споживачів. | `plant-gas/gas-engines` | — |
| Distribution board | щиток (розподільний щит) | — | — | Шафа з апаратами захисту й розподілу груп | `home/home-intro` | — |
| Distribution network | розподільна мережа | — | — | Мережі 0,4–110(150) kV до споживачів. | `distribution/district-substation` | — |
| Distribution transformer | розподільний трансформатор | — | — | 6–20/0,4 kV, 25–2500 kVA. | `transformer/types` | — |
| District heating | централізоване теплопостачання | — | — | Тепло від ТЕЦ/котелень до будівель трубами | `plant-geo-bio/biomass-chp` | — |
| DoD | глибина розряду | DoD | % | частка відданого заряду | `lab-battery/voltage-capacity` | — |
| Donor / acceptor | донор / акцептор | — | — | Домішка, що віддає / захоплює електрон. | `matter` | — |
| Doping | легування | N_D, N_A | cm⁻³ | Контрольоване введення домішок. | `matter/doping` | — |
| Draft tube | відсмоктувальна труба | — | — | Дифузор за колесом. | `plant-hydro/water-path` | — |
| Drift velocity | дрейфова швидкість | v_d | m/s | Спрямована середня швидкість носіїв у полі. | `matter/electron-sea` | `current`, `home` |
| Droop | статизм | — | % | Зміна частоти, за якої регулятор проходить 0→100 % потужності | `grid/reserves` | — |
| Dry low-NOx combustor (DLN) | малотоксична камера згоряння | — | — | Камера з попереднім змішуванням для низьких NOₓ. | `plant-gas` | — |
| Dry steam plant | станція на сухій парі | — | — | Пара з надр іде прямо в турбіну | `plant-geo-bio/geo-plant-types` | — |
| DSO | оператор системи розподілу (ОСР) | — | — | Керує розподільними мережами (обленерго) | `grid/control-room` | `distribution`, `lab-hybrid-home` |
| Duck curve | качина крива | — | — | Добова форма чистого навантаження при великій частці СЕС | `plant-solar/duck-curve` | `grid` |
| Duty cycle | коефіцієнт заповнення | D | — | частка періоду ввімкненого стану ключа | `lab-inverter/dc-link` | — |
| Dynamic line rating (DLR) | динамічна пропускна здатність | — | A | Допустимий струм за реальною погодою. | `transmission/sag-thermal` | — |
| Earth electrode | заземлювач | — | Ω | Електрод у землі. | `distribution/neutral-earthing` | — |
| Earthing switch | заземлювальний ніж | — | — | Заземлює вимкнену ділянку. | `transmission/substation` | — |
| Earthing system | система заземлення | TN-C, TN-S, TN-C-S, TT, IT | — | Спосіб з’єднання N, PE і землі. | `distribution/neutral-earthing` | — |
| Ebb / flood generation | генерація на відплив / приплив | — | — | Напрям потоку крізь турбіни | `plant-ocean` | — |
| ECCS | система аварійного охолодження активної зони | САОЗ | — | Подає воду в реактор при аварії. | `plant-nuclear/safety` | — |
| Economizer | водяний економайзер | — | — | Гріє живильну воду відхідними газами. | `plant-coal/boiler` | — |
| Eddy currents | вихрові струми (струми Фуко) | — | — | Замкнені індуковані струми в масивних провідниках. | `magnetism/lenz` | `transformer` |
| Efficiency | ККД (коефіцієнт корисної дії) | η | % | Частка корисної потужності. | `current/losses` | `transformer`, `plants` |
| EGS | покращена (штучна) геотермальна система | — | — | Створення проникності гідростимуляцією | `plant-geo-bio/egs` | — |
| Electric charge | електричний заряд | q, Q | C | Властивість частинок, що зумовлює електромагнітну взаємодію. | `charge-field/charge` | — |
| Electric current | електричний струм / сила струму | I | A | Заряд, що проходить крізь переріз за секунду. | `current/current` | — |
| Electric field | електричне поле | E⃗ | V/m | Стан простору, через який заряди діють один на одного. | `charge-field/field` | — |
| Electric potential | електричний потенціал | φ | V | Енергія одиничного заряду в точці поля. | `charge-field/potential` | — |
| Electricity meter / smart meter | лічильник / «розумний» лічильник | — | kWh | Облік енергії. | `distribution` | — |
| Electrolysis / electrolyzer | електроліз / електролізер | — | — | Розкладання води струмом / установка для цього | `plant-future` | — |
| Electrolyte | електроліт | — | — | провідник іонів, ізолятор для електронів | `lab-battery/what-is-battery` | — |
| Electromagnet | електромагніт | — | — | Котушка з осердям, магніт, керований струмом. | `magnetism/solenoid` | — |
| Electromagnetic induction | електромагнітна індукція | — | — | Виникнення ЕРС при зміні магнітного потоку. | `magnetism/induction` | — |
| Electromagnetic wave | електромагнітна хвиля | — | — | Самопідтримувані коливання E і B зі швидкістю c. | `magnetism/maxwell` | — |
| Electron | електрон | e⁻ | — | Елементарна частинка з зарядом −e, маса 9,109×10⁻³¹ kg. | `atom/anatomy` | — |
| Electron shell | електронна оболонка | K, L, M, N | — | Стани з однаковим n. | `atom/shells` | — |
| Electronvolt | електронвольт | eV | eV | 1,602×10⁻¹⁹ J. | `atom/models` | `charge-field` |
| Electrostatic induction | електростатична індукція | — | — | Перерозподіл зарядів у провіднику під дією поля. | `charge-field/conductor-in-field` | — |
| Elementary charge | елементарний заряд | e | C | 1,602176634×10⁻¹⁹ C. | `atom/electron` | — |
| EMF (electromotive force) | ЕРС, електрорушійна сила | ℰ, ℰ (миттєва — e) | V | Робота джерела над одиничним зарядом. | `current/source-emf` | `magnetism`, `generator-ac`, `transformer` |
| Energy | енергія (електроенергія) | W | J, kWh, Wh | `W = P·t`. | `current/power` | `home`, `lab-battery` |
| Energy band | енергетична зона | — | eV | Неперервний набір дозволених станів у кристалі. | `matter` | — |
| Energy level | енергетичний рівень | E_n | eV | Дозволене значення енергії електрона. | `atom/models` | — |
| Energy period | енергетичний період | T_e | s | Період, що характеризує енергію хвильового спектра | `plant-ocean/waves` | — |
| Enrichment | збагачення | x | % | Частка U-235 в урані. | `plant-nuclear/chain-reaction` | — |
| ENTSO-E | Європейська мережа операторів систем передачі | — | — | Об’єднання 40 ОСП з 36 країн | `grid/balance` | — |
| EPBT | термін енергетичної окупності | — | рік | час, за який модуль виробляє енергію, витрачену на його виготовлення | `lab-pv/lifecycle` | — |
| EPS / Backup | резервний вихід | — | — | вихід для критичних навантажень у блекаут | `lab-inverter/inverter-types` | — |
| Equipotential | еквіпотенціаль | — | — | Поверхня/лінія однакового потенціалу. | `charge-field/potential` | — |
| Equipotential bonding | зрівнювання потенціалів | — | — | З’єднання металевих частин між собою й з PE | `home/shock` | — |
| ESP | електрофільтр | — | — | Уловлює пил електричним полем. | `plant-coal/flue-gas` | — |
| European efficiency | європейський ККД | η_EU | % | зважене ККД за типових навантажень | `lab-inverter/dc-link` | — |
| EV charging | зарядка електромобілів | — | kW | Змінним струмом (AC) 3,7–22 kW, постійним (DC) 50–350 kW. | `distribution/der` | — |
| Excitation | збудження | i_f | A | Постійний струм обмотки ротора. | `generator-ac/synchronous-generator` | — |
| Farad | фарад | F | F | 1 F = 1 C/V. | `charge-field/conductor-in-field` | — |
| Faraday cage | клітка Фарадея | — | — | Провідна оболонка, що екранує поле. | `charge-field/conductor-in-field` | — |
| Faraday constant | стала Фарадея | F | C/mol | 96 485 C на моль електронів | `plant-future/electrolysis` | — |
| Faraday’s law | закон Фарадея | — | — | ЕРС індукції дорівнює швидкості зміни потоку, взятій з мінусом. | `magnetism/induction` | — |
| FCC | гранецентрована кубічна ґратка | — | — | Атоми у вершинах і центрах граней куба. | `matter/lattice` | — |
| FCR | резерв підтримання частоти (РПЧ) | R_FCR | MW | Автоматична пропорційна відповідь за ≤30 s | `grid/reserves` | — |
| FCR / aFRR | резерв підтримання частоти (РПЧ) / автоматичний резерв відновлення частоти (аРВЧ) | — | MW | Послуги з регулювання частоти | `plant-future` | — |
| Feathering | флюгерування | — | — | Поворот лопатей ребром до вітру для зупинки | `plant-wind/power-curve` | — |
| FEC | повні еквівалентні цикли | FEC | — | відданий заряд / номінальна ємність | `lab-battery/degradation` | — |
| Feeder | фідер | — | — | Лінія від шин підстанції до групи ТП. | `distribution/district-substation` | — |
| Feedwater heater | регенеративний підігрівник | ПНТ/ПВТ | — | Гріє живильну воду парою з відборів. | `plant-coal/feedwater` | — |
| Fermi level | рівень Фермі | E_F | eV | Межа заповнення станів. | `matter/bands` | — |
| Fermi velocity | швидкість Фермі | v_F | m/s | Швидкість найенергійніших електронів «моря». | `matter/electron-sea` | — |
| Ferranti effect | ефект Ферранті | — | — | Ріст напруги на кінці слабко навантаженої лінії. | `transmission/line-physics` | — |
| Ferromagnetism | феромагнетизм | — | — | Самочинна впорядкована намагніченість (Fe, Ni, Co). | `magnetism/domains` | — |
| FGD | сіркоочищення | — | — | Видаляє SO₂ з димових газів. | `plant-coal/flue-gas` | — |
| Field line | силова лінія | — | — | Лінія, дотична до якої збігається з E⃗. | `charge-field/field` | — |
| Field strength | напруженість поля | E | V/m | Сила на одиничний заряд, `E = F/q`. | `charge-field/field` | — |
| Fill factor | коефіцієнт заповнення | FF | — | P_mp/(V_oc·I_sc) | `lab-pv/iv-curve` | — |
| Film cooling | плівкове охолодження | — | — | Плівка повітря на поверхні лопатки. | `plant-gas/hot-section` | — |
| Flash steam plant | станція з миттєвим скипанням | — | — | Гаряча вода під тиском частково закипає в сепараторі | `plant-geo-bio/geo-plant-types` | — |
| Flicker | мерехтіння (флікер) | P_lt | — | Коливання напруги, помітні як пульсація світла. | `distribution/power-quality` | — |
| Flow rate | витрата | Q | m³/s | Об’єм води за секунду. | `plant-hydro/water-energy` | — |
| Flue gas treatment | очищення димових газів | — | — | Видалення пилу, кислих газів, NOₓ, ртуті, діоксинів | `plant-geo-bio/wte` | — |
| Fly ash | летка зола | — | — | Дрібна зола в димових газах. | `plant-coal/ash-co2` | — |
| Free electron | вільний електрон | n | m⁻³ | Електрон, не прив’язаний до атома. | `matter/electron-sea` | — |
| Frequency | частота | f | Hz | Кількість коливань за секунду. | `current/dc-ac` | `generator-ac`, `grid` |
| Frequency deviation | відхилення частоти | Δf | Hz, mHz | Різниця між фактичною і номінальною частотою | `grid/balance` | — |
| Frequency nadir | надир частоти | f_min | Hz | Найнижча частота після втрати генерації | `grid/inertia` | — |
| Fuel cell (PEMFC, SOFC) | паливна комірка | — | — | Електрохімічний генератор, що окиснює паливо без горіння | `plant-future/overview` | — |
| Fuel pellet / rod / assembly | таблетка / твел / ТВЗ | — | — | Ступені «збирання» палива. | `plant-nuclear` | — |
| Full-scale converter | повнопотужний перетворювач | — | — | Перетворювач змінний → постійний → змінний струм на всю потужність турбіни | `plant-wind/drivetrain` | — |
| Furnace | топка | — | — | Камера згоряння котла. | `plant-coal/boiler` | — |
| Fuse | запобіжник | I_n | A | Елемент, що плавиться при надструмі. | `current/circuit` | — |
| Fusion | термоядерний синтез | — | — | Злиття легких ядер з виділенням енергії | `plant-future/overview` | — |
| Fusion gain | коефіцієнт підсилення | Q | — | P_fus / P_heat | `plant-future/fusion-physics` | — |
| Galvanic isolation | гальванічна розв’язка | — | — | Відсутність прямого електричного з’єднання входу й виходу | `home/charger` | — |
| Gas engine | газопоршневий двигун | — | MW | Поршневий ДВЗ на газі з генератором. | `plant-gas/overview` | `plant-geo-bio` |
| Gas turbine | газова турбіна | ГТ | MW | Компресор + камера згоряння + турбіна на валу. | `plant-gas/overview` | — |
| Gate driver | драйвер затвора | — | — | схема керування ключем | `lab-inverter/switches` | — |
| Gearbox | мультиплікатор | i | — | Передача, що підвищує оберти | `plant-wind/nacelle` | — |
| Generation mix | структура генерації | — | % | Частки джерел у річному виробітку. | `plants/mix` | — |
| Generator | генератор | — | kW | резервне джерело на паливі | `lab-hybrid-home/generator` | — |
| Genset | генераторна установка | — | kVA | Двигун + генератор | `plant-future/overview` | — |
| Geothermal gradient | геотермічний градієнт | G | °C/km | Зростання температури з глибиною | `plant-geo-bio/earth-heat` | — |
| GHI / DNI / DHI | сумарна / пряма нормальна / розсіяна опроміненість | — | W/m² | Складники сонячного випромінювання | `plant-solar` | — |
| GIS | КРУЕ (комплектний елегазовий РП) | — | — | Компактна підстанція в трубах з SF₆. | `transmission/substation` | — |
| Gluon | глюон | g | — | Переносник сильної взаємодії. | `atom/quarks` | — |
| GOES | анізотропна електротехнічна сталь | — | — | Кремнієва сталь з орієнтованими зернами. | `transformer/losses-efficiency` | — |
| Governor | регулятор швидкості | — | — | Керує витратою під частоту й навантаження. | `plant-hydro/generator-governor` | — |
| Grid-following / grid-forming (GFL / GFM) | мережевідомий / мережоформувальний інвертор | — | — | режими керування інвертором | `lab-inverter/grid-tie` | — |
| Grid-forming | мережоформувальний режим | — | — | Перетворювач сам задає напругу й частоту | `plant-wind/role` | `plant-future` |
| Grid-forming inverter | мережоформувальний інвертор | — | — | Інвертор, що сам формує напругу й частоту | `grid/future-grid` | — |
| Ground wire / OPGW | грозотрос / трос з оптоволокном | — | — | Захист від блискавки, зв’язок. | `transmission` | — |
| GSU transformer | блочний підвищувальний трансформатор | — | MVA | Біля генератора станції. | `transformer/types` | `plant-coal`, `transmission` |
| GWP | потенціал глобального потепління | GWP | — | Парниковість газу відносно CO₂. | `plant-gas/emissions-hydrogen` | `plant-geo-bio` |
| H-bridge | H-міст (повний міст) | — | — | 4 ключі, що дають +U, 0, −U | `lab-inverter/why-inverter` | — |
| H₂-ready | готовий до водню | — | — | Здатний спалювати суміші з H₂. | `plant-gas/emissions-hydrogen` | — |
| Half-life | період напіврозпаду | T½ | s, рік | Час розпаду половини ядер. | `atom/atom-builder` | `plant-future` |
| Harmonic | гармоніка | U_h | V | складова з частотою h·f₁ | `lab-inverter/pwm` | — |
| Harmonics / THD | гармоніки / коефіцієнт гармонічних спотворень | THD | % | Спотворення синусоїди. | `distribution` | — |
| Head | напір | H, ΔH | m | Різниця рівнів верхнього й нижнього б’єфів. | `plant-hydro/water-energy` | `plant-ocean` |
| Headwater / tailwater | верхній / нижній б’єф | — | — | Вода до греблі / після станції. | `plant-hydro/water-energy` | — |
| Heat engine | тепловий двигун | — | — | Машина, що перетворює частину теплового потоку на роботу. | `plants/heat-engine` | — |
| Heat recovery steam generator (HRSG) | котел-утилізатор | — | — | Котел, що гріється вихлопом ГТ. | `plant-gas/combined-cycle` | — |
| Heliostat | геліостат | — | — | Дзеркало, що відбиває Сонце на нерухомий приймач | `plant-solar/csp-types` | — |
| HF transformer | високочастотний трансформатор | — | — | компактний трансформатор на десятки kHz | `lab-inverter/dc-link` | — |
| Higgs boson | бозон Гіґґса | H | — | Частинка поля, що надає маси елементарним частинкам. | `atom/standard-model` | — |
| Hohlraum | хольраум | — | — | Циліндр, що перетворює лазер на рентген | `plant-future/inertial` | — |
| Hold-up time | час утримання | — | ms | час, протягом якого БЖ тримає вихід без входу | `lab-inverter/ups` | — |
| Hole | дірка | h⁺ | — | Вакансія у валентній зоні, носій +e. | `matter/bands` | — |
| Hot spot | гаряча точка | — | — | перегрів зворотно зміщеної комірки | `lab-pv/shading` | — |
| HP / IP / LP cylinder | циліндр високого / середнього / низького тиску | ЦВТ/ЦСТ/ЦНТ | — | Частини парової турбіни. | `plant-coal/turbine` | — |
| HPP | гідроелектростанція (ГЕС) | — | — | Станція, що використовує енергію потоку води. | `plant-hydro/overview` | — |
| HRT | час перебування | HRT | d | Середній час перебування субстрату в реакторі | `plant-geo-bio/biogas` | — |
| Hub | маточина | — | — | Вузол кріплення лопатей до валу | `plant-wind/nacelle` | — |
| HV / LV winding | обмотка ВН / НН | — | — | Обмотки високої / низької напруги. | `transformer/anatomy` | — |
| HVDC | передача постійним струмом високої напруги | — | kV | Технологія передачі на великі відстані, зокрема з морських ВЕС | `plant-wind/offshore` | `transmission` |
| Hybrid inverter | гібридний інвертор | — | — | інвертор для панелей, батареї, мережі й резервного виходу | `lab-inverter/inverter-types` | — |
| Hybrid PV system | гібридна сонячна система | — | — | панелі, батарея, мережа й резервний вихід | `lab-hybrid-home/overview` | — |
| Hydrogenerator | гідрогенератор | — | MVA | Тихохідний явнополюсний. | `generator-ac/synchronous-generator` | `plant-hydro` |
| Hysteresis | гістерезис | — | — | Залежність намагніченості від історії. | `magnetism/domains` | `transformer` |
| I-V curve | вольт-амперна характеристика | I(V) | A, V | залежність струму від напруги | `lab-pv/iv-curve` | — |
| ICF | інерційний синтез | — | — | Стиснення мішені лазером чи рентгеном | `plant-future/inertial` | — |
| Idle consumption | власне споживання | P₀ | W | споживання інвертора без навантаження | `lab-inverter/choosing` | — |
| IGBT | біполярний транзистор з ізольованим затвором | — | — | ключ для великих струмів і напруг | `lab-inverter/switches` | — |
| Impedance | повний опір (імпеданс) | Z | Ω | Z = √(R² + X²). | `generator-ac/rlc` | — |
| Induced seismicity | наведена сейсмічність | M | — | Землетруси, спричинені діяльністю людини | `plant-geo-bio/egs` | — |
| Inductance | індуктивність | L | H | N·Φ = L·I; 1 H = 1 V·s/A. | `magnetism/inductance` | — |
| Induction motor | асинхронний двигун | — | — | Двигун з ротором, що відстає від поля. | `generator-ac/rotating-field` | — |
| Inertia constant | стала інерції | H | s | Кінетична енергія ротора, віднесена до номінальної потужності | `grid/inertia` | — |
| Inrush current | пусковий струм | I_start | A | Короткий сплеск струму в момент увімкнення | `home/appliances` | `lab-inverter` |
| Installed capacity | встановлена потужність | P_inst | MW, GW | Максимальна тривала потужність станції. | `plants/metrics` | — |
| Insulator / dielectric | ізолятор / діелектрик | — | — | Речовина з мізерною кількістю вільних носіїв. | `matter` | — |
| Insulator string | гірлянда ізоляторів | — | — | Ізолює провід від опори. | `transmission/line-anatomy` | — |
| Intercalation | інтеркаляція | — | — | вбудовування іонів між шарами ґратки | `lab-battery/intercalation` | — |
| Interlock | механічне блокування | — | — | унеможливлює одночасне ввімкнення двох джерел | `lab-hybrid-home/generator` | — |
| Internal resistance | внутрішній опір | r, R₀ | Ω | Опір усередині джерела. | `current/measure` | `lab-battery` |
| Intrinsic carrier concentration | власна концентрація носіїв | n_i | cm⁻³ | Концентрація пар у чистому напівпровіднику. | `matter/bands` | — |
| Inverter | інвертор | — | — | Перетворювач постійного струму на змінний | `plant-solar/inverter-station` | `lab-inverter` |
| Inverter generator | інверторний генератор | — | — | Генератор з електронним формуванням 50 Hz | `plant-future/gensets` | — |
| Ion / cation / anion | іон / катіон / аніон | X⁺, X⁻ | — | Заряджений атом: +, якщо бракує електронів; −, якщо зайві. | `atom` | — |
| Ionization energy | енергія іонізації | E_i | eV | Енергія відриву електрона від атома. | `atom/ions-photons` | — |
| Irradiance | опроміненість | G | W/m² | Потужність сонячного випромінювання на одиницю площі | `plant-solar/sunlight` | `lab-pv` |
| Irradiation | опромінення (сумарне, інсоляція) | H | kWh/m² | Енергія випромінювання на одиницю площі за період | `plant-solar/sunlight` | `lab-pv` |
| Isentropic efficiency | ізоентропний ККД | η_c, η_t | — | Близькість компресора/турбіни до ідеалу. | `plant-gas/brayton-sim` | — |
| Island mode | острівний режим | — | — | живлення будинку без мережі | `lab-hybrid-home/blackout` | — |
| Isolation transformer | розділовий трансформатор | — | — | 1:1, гальванічне розділення. | `transformer/types` | — |
| Isotope | ізотоп | ᴬX | — | Атоми одного елемента з різною кількістю нейтронів. | `atom/nucleus` | — |
| Joule heating | тепло Джоуля | — | W | `P = I²·R`. | `current/power` | — |
| Junction box | розподільна коробка | — | — | коробка з клемами й діодами на тилі модуля | `lab-pv/module` | — |
| Kaplan / Francis / Pelton | поворотно-лопатева / радіально-осьова / ковшова турбіна | — | — | Основні типи гідротурбін. | `plant-hydro` | — |
| KCL | перший закон Кірхгофа | — | — | `ΣI = 0` у вузлі. | `current/series-parallel` | — |
| Kilowatt-hour | кіловат-година | kWh | kWh | 3,6×10⁶ J. | `current/power` | — |
| KVL | другий закон Кірхгофа | — | — | `ΣU = 0` у контурі. | `current/series-parallel` | — |
| Laminated core | шихтоване осердя | — | — | Пакет ізольованих листів сталі. | `transformer/turns-ratio` | — |
| Lawson criterion | критерій Лавсона | n·T·τ_E | keV·s/m³ | Умова самопідтримного синтезу | `plant-future/fusion-physics` | — |
| LC filter | LC-фільтр | f₀ | Hz | ФНЧ з дроселя й конденсатора | `lab-inverter/lc-filter` | — |
| LCC / VSC | перетворювач з мережевою комутацією / перетворювач напруги | — | — | Тиристорний / на IGBT. | `transmission/hvdc` | — |
| LCOE | нормована вартість електроенергії | LCOE | $/MWh, $/kWh | Витрати за життя станції / виробіток (дисконтовано). | `plants/metrics` | `plant-solar` |
| LED | світлодіод | — | — | Діод, що випромінює світло. | `matter/devices` | — |
| Left-hand rule | правило лівої руки | — | — | Напрям сили Ампера. | `magnetism/lorentz` | — |
| Lenz’s law | закон Ленца | — | — | Індукований струм протидіє зміні, що його спричинила. | `magnetism/lenz` | — |
| Lepton | лептон | — | — | Частинка без сильної взаємодії (e, μ, τ, ν). | `atom/electron` | — |
| LFP | літій-залізо-фосфат | — | — | Хімія катода, що домінує в акумуляторних накопичувачах | `plant-future/bess` | — |
| LFP / NMC / NCA / LCO / LMO / LTO | хімії літій-іонних акумуляторів | — | — | різні матеріали катода/анода | `lab-battery` | — |
| LHV | нижча теплота згоряння | Q_i, LHV | MJ/kg | Тепло згоряння без урахування конденсації пари. | `plant-coal/coal` | `plant-geo-bio` |
| LID / LeTID / PID / UVID | види деградації модулів | — | %/рік | світло-, температурно-, потенціально-, УФ-індукована деградація | `lab-pv` | — |
| Lifecycle emissions | викиди за життєвий цикл | — | g CO₂-eq/kWh | Парникові викиди на одиницю енергії від видобутку до демонтажу. | `plants/metrics` | — |
| Lift / Drag | підіймальна сила / сила опору | F_L, F_D | N | Сили на профілі поперек / уздовж потоку | `plant-wind` | — |
| Lightning | блискавка | — | — | Гігантський атмосферний іскровий розряд. | `charge-field/static` | — |
| Lignite / bituminous / anthracite | буре / кам’яне вугілля / антрацит | — | — | Марки вугілля за ступенем вуглефікації. | `plant-coal` | — |
| Limb / yoke | стрижень / ярмо | — | — | Частини осердя з обмотками / замикальні. | `transformer/anatomy` | — |
| Line / Neutral / Protective earth | фазний / нейтральний / захисний провідник | L, N, PE | — | Коричневий / синій / жовто-зелений | `home` | — |
| Line voltage | лінійна напруга | U_L | V | Між фазами (400 V). | `generator-ac/star-delta` | — |
| Lithium ion | іон літію | Li⁺ | — | носій заряду всередині літій-іонного акумулятора | `lab-battery/intercalation` | — |
| Lithium plating | осадження металевого літію | — | — | небезпечний ефект заряду на холоді/великим струмом | `lab-battery/charging` | — |
| Load angle | кут навантаження | δ | ° | Кут між ЕРС генератора і напругою мережі. | `generator-ac/synchronization` | — |
| Load-break switch | вимикач навантаження | — | — | Вмикає/вимикає робочі струми. | `distribution/transformer-substation` | — |
| Load (copper) losses | втрати короткого замикання (в обмотках) | P_k | W | I²R обмоток при номінальному струмі. | `transformer/losses-efficiency` | — |
| Load curve | графік навантаження | P_L(t) | MW | Споживання протягом доби | `grid/load-curve` | — |
| Load shedding | відключення (скидання) навантаження | — | MW | Примусове зменшення споживання (ГПВ, ГАВ, АЧР) | `grid/reserves` | `lab-hybrid-home` |
| Lorentz force | сила Лоренца | F | N | F = q·v×B (магнітна частина). | `magnetism/lorentz` | — |
| Luminous efficacy | світлова віддача | η_v | lm/W | Світло на одиницю потужності | `home/lighting` | — |
| Luminous flux | світловий потік | Φ | lm | Кількість видимого світла | `home/lighting` | — |
| LV network | мережа низької напруги | НН | V | 0,4 kV: 400/230 V. | `distribution/lv-network` | — |
| Magnetic constant | магнітна стала | μ₀ | H/m | ≈ 4π×10⁻⁷ H/m. | `magnetism/oersted` | — |
| Magnetic domain | магнітний домен | — | — | Область з однаковою намагніченістю. | `magnetism/domains` | — |
| Magnetic field / flux density | магнітне поле / магнітна індукція | B | T | Векторна характеристика магнітного поля; 1 T = 1 N/(A·m). | `magnetism` | — |
| Magnetic field strength | напруженість магнітного поля | H | A/m | Допоміжна величина; у вакуумі H = B/μ₀. | `magnetism/maxwell` | — |
| Magnetic flux | магнітний потік | Φ | Wb | Φ = B·A·cos α; 1 Wb = 1 V·s. | `magnetism/magnet-field` | — |
| Magnetic moment | магнітний момент | m | A·m² | Міра «сили» магніту: частинки, рамки зі струмом чи тіла. | `magnetism/domains` | — |
| Magnetic pole (N/S) | магнітний полюс | N, S | — | Ділянки, звідки виходять (N) і куди входять (S) лінії поля. | `magnetism/magnet-field` | — |
| Magnetizing current | струм намагнічування (неробочого ходу) | I₀ | A | Струм для створення потоку. | `transformer/turns-ratio` | — |
| Magnetostriction | магнітострикція | — | — | Зміна розмірів сталі в полі; гул 100 Hz. | `transformer/losses-efficiency` | — |
| Main switch | ввідний вимикач | — | A | Вимикає весь дім | `home/panel` | — |
| Mass number | масове число | A | — | Кількість нуклонів у ядрі. | `atom/nucleus` | — |
| Maximum power point | точка максимальної потужності | MPP, P_mp | W | точка I-V кривої з найбільшим P = U·I | `lab-pv/iv-curve` | — |
| Maxwell’s equations | рівняння Максвелла | — | — | Чотири рівняння класичної електродинаміки. | `magnetism/maxwell` | — |
| MCB | автоматичний вимикач | — | A | Захищає лінію від перевантаження і КЗ | `home/panel` | — |
| MEA | мембранно-електродний блок | — | — | Мембрана з каталізаторами й газодифузійними шарами | `plant-future/fuel-cell` | — |
| Mean free path | довжина вільного пробігу | λ | m | Середня відстань між розсіюваннями. | `matter/electron-sea` | — |
| Medium voltage | середня напруга | СН | kV | Умовно 1–35 kV. | `distribution/district-substation` | — |
| Merit order | черга завантаження за вартістю | — | €/MWh | Сортування генерації від найдешевшої | `grid/load-curve` | — |
| Metallic bond | металічний зв’язок | — | — | Зв’язок іонів через спільний електронний газ. | `matter/lattice` | — |
| Methanogens | метаногени | — | — | Археї, що виробляють метан | `plant-geo-bio/biogas` | — |
| mFRR | ручний резерв відновлення частоти (рРВЧ) | — | MW | Активується диспетчером, ≤12,5 min | `grid/reserves` | — |
| Microgrid | мікромережа | — | — | локальна енергосистема, здатна працювати автономно | `lab-hybrid-home/microgrid-finale` | — |
| MMC | модульний багаторівневий перетворювач | — | — | перетворювач HVDC із сотень субмодулів | `lab-inverter/three-phase-and-scale` | — |
| Mobility | рухливість | μ | cm²/(V·s) | Дрейфова швидкість на одиницю поля. | `matter/silicon` | — |
| Moderator | сповільнювач | — | — | Гальмує нейтрони до теплових енергій. | `plant-nuclear/control` | — |
| Modulation index | коефіцієнт модуляції | m_a | — | відношення амплітуд опорного сигналу й несучої | `lab-inverter/pwm` | — |
| Moisture content | вологість | w | % | Частка води в масі палива | `plant-geo-bio/biomass-fuel` | — |
| Molten salt | розплавлена сіль | — | — | Теплоносій і акумулятор тепла (NaNO₃/KNO₃) | `plant-solar/csp-tower` | — |
| Monopile / Jacket / Floating | монопаля / ґратчаста основа / плавуча платформа | — | — | Типи морських фундаментів | `plant-wind` | — |
| MOSFET | польовий транзистор з ізольованим затвором | — | — | Ключ, керований напругою затвора. | `matter/devices` | `lab-inverter` |
| MPPT | відстеження точки максимальної потужності | — | — | Алгоритм пошуку робочої точки з максимальною P | `plant-solar/inverter-station` | `lab-pv` |
| MPPT window | вікно MPPT | — | V | діапазон напруг відстеження MPP | `lab-pv/array` | — |
| MSR | сепаратор-пароперегрівник | СПП | — | Сушить і підігріває пару між циліндрами турбіни. | `plant-nuclear/primary-loop` | — |
| MSW | тверді побутові відходи (ТПВ) | — | t | Змішані відходи домогосподарств | `plant-geo-bio/wte` | — |
| Multimeter | мультиметр | — | — | Комбінований вимірювальний прилад. | `current/measure` | — |
| Multiplication factor | ефективний коефіцієнт розмноження | k_eff | — | Відношення поділів у сусідніх поколіннях. | `plant-nuclear/chain-reaction` | — |
| Mutual induction | взаємоіндукція | M | H | ЕРС в одній котушці від струму в іншій. | `magnetism/inductance` | `transformer` |
| MWp | мегават-пік | — | MWp | Потужність модулів за стандартних умов випробувань (STC) | `plant-solar/dc-array` | — |
| N-1 criterion | критерій N-1 | — | — | Стійкість до відмови будь-якого одного елемента | `grid/control-room` | — |
| N-PE relay | реле N-PE | — | — | заземлення нейтралі в острові | `lab-hybrid-home/blackout` | — |
| Na-ion | натрій-іонний акумулятор | — | — | акумулятор з іонами Na⁺ | `lab-battery/chemistries` | — |
| Nacelle | гондола | — | — | Корпус на башті з приводом, генератором і електронікою | `plant-wind/nacelle` | — |
| Natural gas / methane | природний газ / метан | CH₄ | — | Паливо, основний компонент — метан. | `plant-gas` | — |
| Net billing | нетто-білінг (самовиробництво) | — | — | Вартість відданої енергії зараховують в оплату спожитої. | `distribution/der` | — |
| Net load | чисте (залишкове) навантаження | L_net, P_net | W, MW | Споживання мінус змінна генерація | `plant-solar/duck-curve` | `grid` |
| Neutral | нейтраль | N | — | Провідник від нульової точки зірки. | `generator-ac/three-phase` | `distribution` |
| Neutron | нейтрон | n⁰, n | — | Нейтральна частинка ядра, маса 1,675×10⁻²⁷ kg. | `atom/nucleus` | `plant-nuclear` |
| NMOT | номінальна робоча температура модуля | NMOT | °C | T комірки за 800 W/m², 20 °C, 1 m/s | `lab-pv/light-and-heat` | — |
| No-load (iron) losses | втрати неробочого ходу (в сталі) | P₀ | W | Гістерезис + вихрові струми. | `transformer/losses-efficiency` | — |
| Node / loop | вузол / контур | — | — | Точка з’єднання ≥3 провідників / замкнений шлях. | `current` | — |
| Normally open point (NOP) | точка нормального розмикання | — | — | Розімкнений у нормальному режимі апарат у кільці. | `distribution/district-substation` | — |
| NPP | атомна електростанція (АЕС) | — | — | Станція, що використовує тепло поділу ядер. | `plant-nuclear/overview` | — |
| Nuclear fission | поділ ядра | — | MeV | Розпад важкого ядра на два легші з виділенням енергії. | `plant-nuclear/fission` | — |
| Nucleon | нуклон | — | — | Протон або нейтрон. | `atom/nucleus` | — |
| Nucleus | атомне ядро | — | — | Позитивний центр атома з протонів і нейтронів. | `atom/anatomy` | — |
| OCGT | ГТУ простого циклу | — | — | ГТ без утилізації тепла вихлопу. | `plant-gas/overview` | — |
| OCV | напруга розімкненого кола | U_OCV | V | напруга в спокої | `lab-battery/voltage-capacity` | — |
| Ohm | ом | Ω | Ω | 1 Ω = 1 V/A. | `current/ohm` | — |
| Ohm’s law | закон Ома | — | — | `U = I·R`. | `current/ohm` | — |
| OLTC | РПН, регулювання під навантаженням | — | — | Перемикач відгалужень без вимкнення. | `transformer/anatomy` | `grid` |
| Open-circuit voltage | напруга неробочого ходу | V_oc | V | напруга при I = 0 | `lab-pv/iv-curve` | — |
| Optimizer / Microinverter (MLPE) | оптимізатор / мікроінвертор | — | — | силова електроніка на рівні модуля | `lab-pv` | — |
| Orbital | орбіталь | — | — | Область імовірного перебування електрона. | `atom/models` | — |
| OTEC | океанська теплова енергетика | — | — | Теплова машина на різниці температур поверхні й глибини океану | `plant-ocean/otec-salinity` | — |
| Overhead line | повітряна лінія (ПЛ, ЛЕП) | — | — | Неізольовані проводи на опорах. | `transmission/plant-exit` | — |
| Overtopping device | пристрій з переливанням | — | — | Резервуар, який наповнюють хвилі | `plant-ocean/wave-devices` | — |
| OWC | коливальний водяний стовп | — | — | Камера, де хвиля качає повітря крізь турбіну | `plant-ocean/wave-devices` | — |
| p-n junction | p-n перехід | — | — | Межа p- і n-областей. | `matter/pn-junction` | — |
| P&O | збурення і спостереження | — | — | найпоширеніший алгоритм MPPT | `lab-pv/mppt` | — |
| Parabolic trough | параболічний жолоб | — | — | Лінійний концентратор із трубкою у фокусі | `plant-solar/csp-types` | — |
| PCS | система перетворення енергії | — | MW | Двонапрямний інвертор накопичувача | `plant-future/bess` | — |
| Peaker | пікова станція | — | — | Працює в години максимуму. | `plant-gas/overview` | — |
| PEN conductor | PEN-провідник | PEN | — | Суміщений N і PE. | `distribution/neutral-earthing` | — |
| Penstock | напірний водовід | — | — | Труба від водоприймача до турбіни. | `plant-hydro/water-path` | — |
| Per unit | відносні одиниці (в. о.) | p.u. | — | Величина в частках номінального значення. | `generator-ac/synchronization` | `grid` |
| PERC / TOPCon / HJT / BC | покоління кремнієвих комірок | — | — | технології з різною пасивацією і розташуванням контактів | `lab-pv/cell` | — |
| Performance ratio | коефіцієнт продуктивності | PR | — | Реальний виробіток / теоретичний за опроміненням | `plant-solar/capacity-factor` | — |
| Period | період | T | s | Тривалість одного циклу. | `generator-ac/ac-anatomy` | — |
| Phase balancing | симетрування фаз | — | — | Рівномірний розподіл навантаження. | `distribution/lv-network` | — |
| Phase shift | зсув фаз | φ | °, rad | Різниця кутів двох синусоїд. | `generator-ac/three-phase` | — |
| Phase voltage | фазна напруга | U_ph | V | Між фазою і нейтраллю (230 V). | `generator-ac/star-delta` | — |
| Phasor | фазор (обертовий вектор) | — | — | Стрілка, проєкція якої дає миттєве значення. | `generator-ac/rotating-loop` | — |
| Phonon | фонон | — | — | Квант коливань ґратки. | `matter/resistance` | — |
| Photon | фотон | γ | — | Квант електромагнітного випромінювання. | `atom/ions-photons` | `lab-pv` |
| Photovoltaic effect | фотовольтаїчний ефект | — | — | виникнення напруги/струму в p-n переході під дією світла | `lab-pv/pv-effect` | — |
| Pitch system | система повороту лопатей | β | ° | Поворот лопатей довкола їхньої осі | `plant-wind/nacelle` | — |
| Planck constant | стала Планка | h | J·s | 6,62607015×10⁻³⁴ J·s. | `atom/ions-photons` | — |
| Plasma | плазма | — | — | Іонізований газ з ядер і електронів | `plant-future/fusion-physics` | — |
| PLL | фазове автопідлаштування частоти | — | — | система синхронізації з мережею | `lab-inverter/grid-tie` | — |
| PMSG | синхронний генератор з постійними магнітами | — | — | Генератор, поле якого створюють постійні магніти | `plant-wind/drivetrain` | — |
| Point absorber | точковий поглинач | — | — | Буй, рух якого відбирає енергію | `plant-ocean/wave-devices` | — |
| Polarization | поляризація | — | — | Зміщення зв’язаних зарядів у діелектрику. | `charge-field/static` | — |
| Polarization curve | поляризаційна крива | U(i) | V | Залежність напруги комірки від густини струму | `plant-future/fuel-cell` | — |
| Pole pairs | пари полюсів | p | — | Кількість пар N–S поля. | `generator-ac/rotating-field` | — |
| Power | потужність | P | W | `P = U·I`. | `current/source-emf` | — |
| Power cable (XLPE) | силовий кабель (ізоляція ЗПЕ) | — | — | Ізольований провідник під землею/водою. | `transmission/cables` | — |
| Power coefficient | коефіцієнт потужності | C_p | — | Частка потужності потоку, яку забирає ротор | `plant-wind/betz` | — |
| Power curve | крива потужності | P(v) | W | Залежність потужності від швидкості вітру | `plant-wind/power-curve` | — |
| Power factor | коефіцієнт потужності | cos φ (PF) | — | P/S. | `generator-ac/ac-power` | `home` |
| Power loss | втрати потужності | P_loss | W | `I²·R` у проводах. | `current/losses` | — |
| Power plant | електростанція | — | — | Установка, що перетворює первинну енергію на електричну. | `plants/intro` | — |
| Power quality | якість електроенергії | — | — | Відповідність EN 50160. | `distribution/power-quality` | — |
| Power system | енергосистема | — | — | Станції, мережі й споживачі зі спільним режимом роботи | `grid/grid-intro` | — |
| Power-to-gas | перетворення електрики на газ | P2G | — | Виробництво H₂ (або CH₄) з електрики | `plant-future/electrolysis` | — |
| Poynting vector | вектор Пойнтінга | S | W/m² | S = E×H — потік енергії поля. | `magnetism/maxwell` | `home` |
| PPC | контролер електростанції | — | — | Система, що керує всіма інверторами як одним генератором | `plant-solar/substation-control` | — |
| Pressure ratio | ступінь підвищення тиску | r | — | p₂/p₁ компресора. | `plant-gas/brayton-sim` | — |
| Pressurizer | компенсатор тиску | — | MPa | Підтримує тиск першого контуру. | `plant-nuclear/primary-loop` | — |
| Primary energy | первинна енергія | — | J, kWh | Енергія природного джерела до перетворень. | `plants/intro` | — |
| Primary / secondary winding | первинна / вторинна обмотка | N₁, N₂ | — | Обмотки входу / виходу енергії. | `transformer` | — |
| PRO / RED | осмос із протитиском / зворотний електродіаліз | — | — | Мембранні методи отримання енергії солоності | `plant-ocean` | — |
| Prosumer | активний споживач (просьюмер) | — | — | Споживач-виробник. | `distribution/der` | `lab-hybrid-home` |
| Protective earth | захисний провідник | PE | — | Заземлення корпусів. | `distribution/neutral-earthing` | — |
| Proton | протон | p⁺ | — | Частинка ядра із зарядом +e, маса 1,673×10⁻²⁷ kg. | `atom/nucleus` | — |
| PSP | гідроакумулювальна електростанція (ГАЕС) | — | — | Накопичувач енергії на перекачуванні води. | `plant-hydro/overview` | — |
| PTO (power take-off) | вузол відбору потужності | — | — | Механізм, що перетворює рух пристрою на електрику | `plant-ocean/wave-devices` | — |
| Pulveriser | вугільний млин | — | — | Подрібнює вугілля до пилу. | `plant-coal/coal-to-dust` | — |
| Pump-turbine | насос-турбіна | — | — | Оборотна машина ГАЕС. | `plant-hydro/pumped-storage` | — |
| PV module | фотоелектричний модуль (сонячна панель) | — | Wp | герметична збірка комірок | `lab-pv/module` | — |
| PV (photovoltaics) | фотовольтаїка | — | — | Пряме перетворення світла на електрику | `plant-solar/overview` | — |
| PWM / SPWM | ШІМ / синусоїдна ШІМ | — | — | модуляція ширини імпульсів | `lab-inverter` | — |
| PWR / VVER | водо-водяний реактор під тиском / ВВЕР | — | — | Двоконтурний легководний реактор. | `plant-nuclear` | — |
| Quark | кварк | u, d… | — | Фундаментальна складова протонів і нейтронів. | `atom/quarks` | — |
| Radial / ring / meshed | радіальна / кільцева / сітчаста | — | — | Топології мереж. | `distribution/district-substation` | — |
| Radiator | радіатор | — | — | Теплообмінник оливо–повітря. | `transformer/anatomy` | — |
| Ramp rate | швидкість зміни навантаження | — | %/min, MW/min | Як швидко станція змінює потужність. | `plants/flexibility` | `grid` |
| Rankine cycle | цикл Ренкіна | — | — | Паротурбінний цикл із конденсацією. | `plants/rankine` | — |
| Rated current | номінальний струм | In | A | Струм, на який розрахований автомат | `home/mcb` | — |
| Rated residual operating current | номінальний диференційний струм | IΔn | mA | Уставка ПЗВ (10/30/100/300 mA) | `home/rcd` | — |
| RCBO | диференційний автоматичний вимикач (дифавтомат) | — | A, mA | Автоматичний вимикач і ПЗВ в одному корпусі | `home/panel` | — |
| RCD | ПЗВ, пристрій захисного вимкнення | — | — | Вимикає лінію, щойно струм витікає «убік» | `home/panel` | — |
| RCP | головний циркуляційний насос | ГЦН | — | Жене теплоносій першого контуру. | `plant-nuclear/primary-loop` | — |
| Reactance | реактивний опір | X | Ω | X_L = ωL, X_C = 1/(ωC). | `generator-ac/synchronization` | — |
| Reactive power | реактивна потужність | Q | var | Потужність обміну з полями. | `generator-ac/ac-power` | `grid` |
| Reactive power compensation | компенсація реактивної потужності | — | — | Локальне покриття Q конденсаторами тощо. | `generator-ac/ac-power` | — |
| Reactivity | реактивність | ρ | pcm | `(k − 1)/k`. | `plant-nuclear/control` | — |
| Recloser | реклоузер | — | — | Вимикач на опорі з власним захистом і АПВ. | `distribution/mv-lines` | — |
| Reconnection time | час спостереження перед підключенням | — | s | пауза перед поверненням до мережі | `lab-hybrid-home` | — |
| Rectifier | випрямляч | — | — | перетворювач змінного струму на постійний | `lab-inverter/why-inverter` | — |
| Redox | окисно-відновна реакція | — | — | реакція з передачею електронів | `lab-battery/what-is-battery` | — |
| Reheater | проміжний пароперегрівник | — | — | Повторно гріє пару після ЦВТ. | `plant-coal/boiler` | — |
| Reinjection | зворотне закачування (реінжекція) | — | — | Повернення відпрацьованого розсолу в пласт | `plant-geo-bio/geo-plant-types` | — |
| Relative permeability | відносна магнітна проникність | μ_r | — | У скільки разів матеріал підсилює поле. | `magnetism/solenoid` | — |
| Relative permittivity | відносна діелектрична проникність | ε_r | — | Коефіцієнт збільшення ємності діелектриком. | `charge-field/capacitor` | — |
| Relay protection | релейний захист (РЗА) | — | — | Виявляє КЗ і вимикає. | `transmission/substation` | — |
| Remanence / coercivity | залишкова намагніченість / коерцитивна сила | B_r, H_c | T, A/m | Що лишається без поля / яке зворотне поле розмагнічує. | `magnetism/domains` | — |
| Reservoir | геотермальний резервуар | — | — | Проникні породи з гарячою водою/парою | `plant-geo-bio/earth-heat` | — |
| Residual current | диференційний струм | I_Δ | mA | Різниця струмів у L і N | `home/rcd` | — |
| Resistance | опір | R | Ω | `R = U/I`. | `current/ohm` | — |
| Resistivity | питомий опір | ρ | Ω·m | Опір зразка 1 m × 1 m². | `matter/insulators` | `current` |
| Resonance | резонанс | f₀ | Hz | X_L = X_C; f₀ = 1/(2π√LC). | `generator-ac/rlc` | — |
| Reverse power flow | зворотний переток | — | — | Потік від споживачів до ТП. | `distribution/der` | — |
| Right-hand rule | правило правої руки (свердлика) | — | — | Напрям B навколо струму. | `magnetism/oersted` | — |
| RMS value | діюче значення | U_rms, U, I | V, A | `U_max/√2` для синусоїди. | `current/dc-ac` | `generator-ac` |
| RoCoF | швидкість зміни частоти | df/dt | Hz/s | Наскільки швидко падає/росте частота | `plant-future/bess-services` | `grid` |
| Rotating magnetic field | обертове магнітне поле | — | — | Поле багатофазних обмоток, що обертається. | `generator-ac/rotating-field` | — |
| Round-trip efficiency | ККД циклу | η_cycle, η_rt, η_RT | % | Відношення виданої енергії до спожитої. | `plant-hydro/pumped-storage` | `plant-future`, `lab-hybrid-home` |
| RPV | корпус реактора | — | — | Посудина під тиском з активною зоною. | `plant-nuclear/reactor` | — |
| RR | резерв заміщення (РЗ) | — | MW | Повільні ресурси, що звільняють резерви відновлення частоти | `grid/reserves` | — |
| RTG | радіоізотопний термоелектричний генератор | — | W | Генератор на теплі радіоактивного розпаду | `plant-future/exotic` | — |
| Run-of-river | ГЕС на стоку | — | — | ГЕС без регулювального водосховища (не плутати з «русловою» — це тип компонування). | `plant-hydro/dams` | — |
| Runner | робоче колесо | — | — | Обертова частина турбіни. | `plant-hydro/water-path` | — |
| Sag | стріла провисання | D | m | Провисання проводу в прольоті. | `transmission/sag-thermal` | — |
| Salinity gradient power | енергія градієнта солоності | — | — | Енергія змішування прісної та солоної води | `plant-ocean/otec-salinity` | — |
| Saturation | насичення | B_sat | T | Межа зростання намагніченості осердя. | `magnetism/solenoid` | — |
| SCADA | система диспетчерського керування | — | — | Збір даних і керування. | `transmission/substation` | — |
| SCADA / EMS | диспетчерський контроль / система керування енергосистемою | — | — | Збір даних і аналіз режимів | `grid` | — |
| SCR | селективне каталітичне відновлення | — | — | Видаляє NOₓ аміаком на каталізаторі. | `plant-coal/flue-gas` | — |
| SCRAM | аварійний захист | АЗ | — | Швидке глушіння реактора. | `plant-nuclear/reactor-sim` | — |
| Secondary substation | трансформаторна підстанція | ТП, КТП, ЩТП | — | 6–20/0,4 kV. | `distribution/transformer-substation` | — |
| Seebeck effect | ефект Зеєбека | S | V/K | Виникнення напруги від різниці температур | `plant-future/exotic` | — |
| SEI | твердоелектролітна міжфазна плівка | — | nm | захисна плівка на аноді | `lab-battery/cell-anatomy` | — |
| Selectivity | селективність | — | — | Спрацьовує найближчий захист. | `distribution/power-quality` | — |
| Self-consumption | самоспоживання | SC | % | частка власної генерації, використана на місці | `lab-hybrid-home/overview` | — |
| Self-induction | самоіндукція | — | — | ЕРС від зміни власного струму. | `magnetism/inductance` | — |
| Self-sufficiency | самодостатність | SS | % | частка потреби, покрита без мережі | `lab-hybrid-home/day-mode` | — |
| Semiconductor | напівпровідник | — | — | Речовина з малою E_g і керованою провідністю. | `matter/bands` | — |
| Semidiurnal tide (M2) | півдобовий приплив | T_M2 | h | Головна складова припливу, 12,42 h | `plant-ocean/tides` | — |
| Separator | сепаратор | — | μm | пориста плівка між електродами | `lab-battery/cell-anatomy` | — |
| Series / parallel | послідовне / паралельне з’єднання | — | — | Спільний струм / спільна напруга. | `current` | — |
| Service entrance | ввід | — | — | Приєднання будинку до мережі. | `distribution/service-entrance` | — |
| SF₆ | елегаз | — | — | Ізоляційний і дугогасний газ. | `transmission/substation` | — |
| Shockley–Queisser limit | межа Шоклі–Квайссера | — | % | теоретична межа ККД однокаскадного елемента | `lab-pv/pv-effect` | — |
| Shoot-through | наскрізний струм | — | A | КЗ джерела через обидва ключі стійки | `lab-inverter/h-bridge` | — |
| Short circuit | коротке замикання (КЗ) | I_sc, I_k | A, kA | Обхід навантаження з майже нульовим опором. | `current/circuit` | `transmission` |
| Short-circuit current | струм короткого замикання | I_sc | A | струм при U = 0 | `lab-pv/iv-curve` | — |
| Shunt reactor | шунтовий реактор | — | Mvar | Поглинає надлишкову реактивну потужність. | `transmission/line-physics` | — |
| SiC / GaN | карбід кремнію / нітрид галію | — | — | широкозонні матеріали силових ключів | `lab-inverter` | — |
| Significant wave height | значуща висота хвиль | H_s | m | Середня висота найвищої третини хвиль | `plant-ocean/waves` | — |
| SIL | натуральна потужність | P_нат | MW | U²/Z_c. | `transmission/line-physics` | — |
| Single-axis tracker | одноосьовий трекер | R | ° | Конструкція, що повертає модулі за Сонцем | `plant-solar/trackers` | — |
| Single-line diagram (SLD) | однолінійна схема | — | — | спрощене креслення з’єднань системи | `lab-hybrid-home/single-line` | — |
| Sizing | розрахунок системи | — | — | підбір потужностей і ємностей | `lab-hybrid-home/sizing` | — |
| Skin effect | скін-ефект | δ | mm | Витіснення змінного струму до поверхні провідника. | `transmission/line-physics` | — |
| Slack water | стояча вода | — | — | Момент зміни напряму течії | `plant-ocean/tidal-stream` | — |
| Slip | ковзання | s | % | (n_s − n)/n_s. | `generator-ac/rotating-field` | — |
| Slip rings | контактні кільця | — | — | Виводять змінну ЕРС з обертової рамки. | `magnetism/to-generator` | — |
| Sluice gate | затвор водопропускного отвору | — | — | Щит, що відкриває отвір у греблі для швидкого наповнення басейну | `plant-ocean/barrage` | — |
| SMPS | імпульсний блок живлення | — | W | Перетворювач з високочастотним ключем | `home/charger` | — |
| SMR | малий модульний реактор | — | MW | Реактор до ≈ 300 MW заводського виготовлення. | `plant-nuclear/reactor-types` | — |
| SOC | рівень заряду | SOC | % | Частка доступної енергії | `plant-future/bess` | `lab-battery` |
| Socket-outlet / plug | розетка / вилка | — | A, V | Роз’ємне з’єднання приладу з мережею | `home` | — |
| SOH | стан здоров’я | SOH | % | залишкова ємність відносно нової | `lab-battery/bms` | — |
| Solar cell | сонячний елемент (комірка) | — | — | p-n перехід, що перетворює світло на струм. | `matter/devices` | `lab-pv` |
| Solar constant | сонячна стала | G_sc | W/m² | 1361 W/m² за межами атмосфери | `plant-solar/sunlight` | `lab-pv` |
| Solenoid | соленоїд | — | — | Довга циліндрична котушка; B = μ₀nI. | `magnetism/solenoid` | — |
| Span | проліт | S | m | Відстань між опорами. | `transmission/line-anatomy` | — |
| SPD | ПЗІП (пристрій захисту від імпульсних перенапруг) | — | kA | Відводить імпульсні перенапруги в землю | `home/panel` | `lab-pv`, `lab-hybrid-home` |
| Specific energy | питома енергія | w | Wh/kg | енергія на одиницю маси | `lab-battery/why-lithium` | — |
| Specific work | питома робота | w_net | kJ/kg | Корисна робота з 1 kg повітря. | `plant-gas/brayton-sim` | — |
| Specific yield | питомий виробіток | Y | kWh/kWp, kWh/kWp·рік | Річна енергія на одиницю встановленої потужності | `plant-solar/capacity-factor` | `lab-pv` |
| Spent fuel | відпрацьоване ядерне паливо | ВЯП | t | Паливо після використання в реакторі. | `plant-nuclear/fuel-cycle` | — |
| Spillway | водоскид | — | m³/s | Пропуск надлишкової води повз турбіни. | `plant-hydro/overview` | — |
| Spin | спін | s | — | Власний момент імпульсу частинки. | `atom/electron` | `magnetism` |
| Spiral case | спіральна камера | — | — | Розподіляє воду по колу турбіни. | `plant-hydro/water-path` | — |
| Spring / neap tide | сизигійний / квадратурний приплив | — | — | Найбільші / найменші припливи циклу 14,8 доби | `plant-ocean` | — |
| Squirrel-cage rotor | короткозамкнений ротор («біляча клітка») | — | — | Стрижні, замкнені кільцями. | `generator-ac/rotating-field` | — |
| Stack | стек | N | — | Послідовно з’єднані комірки | `plant-future/fuel-cell` | — |
| Stall | зрив потоку | — | — | Відрив потоку від профілю за великого кута атаки | `plant-wind/blade` | — |
| Standard connection | стандартне приєднання | — | kW | До 16 kW (I ступінь) / до 50 kW (II). | `distribution/service-entrance` | — |
| Standard electrode potential | стандартний електродний потенціал | E° | V | потенціал напівреакції відносно стандартного водневого електрода | `lab-battery/what-is-battery` | — |
| Standard Model | Стандартна модель | — | — | Теорія елементарних частинок і трьох взаємодій. | `atom/standard-model` | — |
| Star (wye) | зірка | Y | — | З’єднання обмоток у спільну точку. | `generator-ac/star-delta` | — |
| STATCOM | статичний синхронний компенсатор | — | Mvar | Інвертор, що видає/споживає Q | `grid/voltage` | — |
| Stator / rotor | статор / ротор | — | — | Нерухома / обертова частина. | `generator-ac/synchronous-generator` | — |
| STC | стандартні умови випробування | — | — | 1000 W/m², 25 °C у комірці, спектр AM1,5G | `lab-pv/sunlight` | — |
| Steam generator | парогенератор | ПГ | — | Теплообмінник між контурами. | `plant-nuclear/primary-loop` | — |
| Steam island | паровий острів | — | — | Турбіна, генератор, конденсатор, насоси, охолодження. | `plants/steam-island` | — |
| Step-up / step-down | підвищувальний / понижувальний | — | — | Збільшує / зменшує напругу. | `transformer/turns-ratio` | — |
| String | ланцюжок модулів | — | — | Послідовно з’єднані модулі | `plant-solar/dc-array` | `lab-pv` |
| Strong interaction | сильна взаємодія | — | — | Утримує кварки в нуклонах і нуклони в ядрі. | `atom/nucleus` | — |
| Substation | підстанція (ПС) | — | — | Вузол перетворення й розподілу. | `transmission/substation` | — |
| Superalloy | жароміцний сплав | — | — | Нікелевий сплав для гарячої частини. | `plant-gas/hot-section` | — |
| Superconductivity | надпровідність | T_c | K | Нульовий опір нижче критичної температури. | `matter/resistance` | — |
| Supercritical / ultra-supercritical (SC / USC) | надкритичні / ультранадкритичні параметри | — | — | Тиск вище критичного / і пара ≥ ≈ 600 °C. | `plant-coal/steam-params` | — |
| Superheater | пароперегрівник | — | — | Перегріває свіжу пару. | `plant-coal/boiler` | — |
| Superposition | суперпозиція | — | — | Поля зарядів додаються векторно. | `charge-field/field` | — |
| Surge arrester | ОПН (обмежувач перенапруг) | — | — | Відводить перенапруги в землю. | `transmission/substation` | — |
| Surge impedance | хвильовий опір | Z_c | Ω | √(L/C). | `transmission/line-physics` | — |
| Surge tank | зрівняльний резервуар | — | — | Гасить гідроудар. | `plant-hydro/water-path` | — |
| Survival mode | режим виживання | — | — | Захисний режим пристрою в шторм | `plant-ocean/survival` | — |
| Swell | зиб | — | — | Хвилі, що прийшли з далекого шторму | `plant-ocean/waves` | — |
| Swept area | площа ротора | A | m² | Площа кола, яке описують лопаті | `plant-wind/wind-power` | — |
| Switch | вимикач | — | — | Замикає й розмикає коло. | `current/circuit` | — |
| Switching station | розподільний пункт | РП | — | Вузол СН без трансформації. | `distribution/mv-lines` | — |
| Switchyard (AIS) | відкритий розподільний пристрій (ВРП) | — | — | РП просто неба. | `transmission/plant-exit` | — |
| Synchronization | синхронізація | — | — | Вмикання при збігу f, U, фази. | `generator-ac/synchronization` | — |
| Synchronous area | синхронна зона | — | — | Область, де всі генератори працюють з однією частотою | `grid/grid-intro` | — |
| Synchronous generator | синхронний генератор | — | VA, W | Генератор, ротор якого обертається синхронно з полем. | `generator-ac/synchronous-generator` | `plants` |
| Synchronous speed | синхронна швидкість | n_s | rpm | n_s = 60f/p. | `generator-ac/rotating-field` | — |
| Synchroscope | синхроноскоп | — | — | Прилад різниці фаз генератора й мережі. | `generator-ac/synchronization` | `grid` |
| Synthetic inertia | синтетична інерція | — | — | Імітація інерції перетворювачем за рахунок енергії ротора | `plant-wind/role` | — |
| Tap | відгалуження (розм. «відпайка») | n | — | Відвід від частини витків. | `transformer/anatomy` | — |
| Technology readiness level (TRL) | рівень технологічної готовності | — | 1–9 | Шкала зрілості технології | `plant-ocean/role` | — |
| Temperature coefficient of resistance | температурний коефіцієнт опору | α | K⁻¹ | Відносна зміна опору на 1 K. | `matter/resistance` | — |
| Temperature coefficients (PV module) | температурні коефіцієнти модуля | α, β, γ | %/°C | відносна зміна параметра на 1 °C | `lab-pv` | — |
| TES | накопичувач теплової енергії | — | MWh_th | Резервуари з гарячим теплоносієм | `plant-solar/csp-tower` | — |
| THD | коефіцієнт гармонічних спотворень | THD | % | відношення діючого значення вищих гармонік до основної | `lab-inverter/h-bridge` | — |
| Thermal barrier coating (TBC) | теплозахисне покриття | — | mm | Керамічний шар на лопатці. | `plant-gas/hot-section` | — |
| Thermal runaway | тепловий розгін | — | °C | самоприскорюваний перегрів комірки | `lab-battery/safety` | — |
| Three-phase system | трифазна система | L1, L2, L3 | — | Три ЕРС, зсунуті на 120°. | `generator-ac/three-phase` | — |
| Threshold voltage | порогова напруга | U_th | V | Напруга затвора, з якої утворюється канал. | `matter/devices` | — |
| Thrust bearing | підп’ятник | — | — | Тримає вагу ротора вертикального агрегату. | `plant-hydro/generator-governor` | — |
| Tidal barrage | припливна гребля | — | — | Дамба з турбінами через затоку | `plant-ocean/barrage` | — |
| Tidal lagoon | припливна лагуна | — | — | Штучний басейн з кільцевою дамбою | `plant-ocean/barrage` | — |
| Tidal range | величина (висота) припливу | H | m | Різниця рівнів повної і малої води (удвічі більша за амплітуду) | `plant-ocean/tides` | — |
| Tidal stream turbine | турбіна припливної течії | — | — | Підводний ротор, що працює від течії | `plant-ocean/tidal-stream` | — |
| Tide | приплив і відплив | — | — | Періодичні коливання рівня моря під дією Місяця й Сонця | `plant-ocean/tides` | — |
| Tilt / Azimuth | нахил / азимут | β, γ | ° | орієнтація площини модуля (ті самі літери позначають і температурні коефіцієнти, тому в підписах — слова «нахил», «азимут») | `lab-pv` | — |
| Time constant | стала часу | τ | s | `τ = R·C`. | `charge-field/bridge-to-matter` | `magnetism` |
| Tip speed ratio | швидкохідність | λ | — | Відношення швидкості кінчика лопаті до швидкості вітру | `plant-wind/blade` | — |
| TIT | температура газу перед турбіною | TIT | °C | Головний чинник ККД і потужності ГТ. | `plant-gas/gas-turbine` | — |
| Tokamak / Stellarator | токамак / стелератор | — | — | Магнітні пастки для плазми | `plant-future/tokamak` | — |
| Torque | обертовий момент | τ (M) | N·m | Добуток сили на плече. | `magnetism/dc-motor` | — |
| TOU tariff | багатозонний тариф | — | грн/kWh | ціна залежно від часу доби | `lab-hybrid-home` | — |
| Touch voltage | напруга дотику | U_t | V | Напруга між частинами, яких торкається людина | `home/shock` | — |
| Tower (suspension / dead-end) | опора (проміжна / анкерна) | — | — | Підтримує / тримає натяг. | `transmission/line-anatomy` | — |
| TPP | теплова електростанція (ТЕС) | — | — | Станція з паровим циклом на органічному паливі. | `plant-coal/overview` | — |
| Transfer time | час перемикання | t_tr | ms | тривалість перерви при переході на батарею | `lab-inverter/ups` | `lab-hybrid-home` |
| Transformer | трансформатор | T | — | Статичний апарат, що змінює рівень змінної напруги. | `transformer/mutual-induction` | — |
| Transformer oil | трансформаторна олива | — | — | Ізоляційна й охолоджувальна рідина. | `transformer/anatomy` | — |
| Triboelectric effect | трибоелектричний ефект | — | — | Електризація при контакті різних матеріалів. | `charge-field/static` | — |
| Tripping curve B/C/D | крива спрацювання B/C/D | — | ×In | Кратність струму миттєвого спрацювання | `home/mcb` | — |
| TSO | оператор системи передачі (ОСП) | — | — | Керує магістральною мережею й балансом | `grid/control-room` | — |
| Turbine | турбіна | — | — | Лопаткова машина, що перетворює енергію потоку на обертання вала. | `plants/turbine-generator` | — |
| Turbogenerator | турбогенератор | — | — | Швидкохідний (3000/1500 rpm) неявнополюсний. | `generator-ac/synchronous-generator` | — |
| Turns ratio | коефіцієнт трансформації | k | — | N₁/N₂ = U₁/U₂. | `transformer/turns-ratio` | — |
| UFLS | автоматичне частотне розвантаження (АЧР) | — | — | Ступінчасте відключення навантаження при низькій частоті | `grid/reserves` | — |
| Unit cell | елементарна комірка | a | m | Найменший повторюваний фрагмент ґратки. | `matter/lattice` | — |
| UPS | джерело безперебійного живлення (ДБЖ) | — | VA, Wh, W | Підтримує живлення, коли зникає мережа | `home/backup` | `lab-inverter` |
| USB PD | протокол швидкого заряджання | — | V, W | Узгоджує напругу й потужність заряджання через USB | `home/charger` | — |
| V2H / V2L / V2G | живлення з авто будинку / приладів / мережі | — | kW | двонапрямне використання батареї електромобіля | `lab-hybrid-home/variants` | — |
| Vacuum permittivity | електрична стала | ε₀ | F/m | 8,854×10⁻¹² F/m. | `charge-field/coulomb` | — |
| Valence band | валентна зона | E_v | eV | Верхня заповнена зона. | `matter/bands` | — |
| Valence electron | валентний електрон | — | — | Електрон зовнішньої оболонки. | `atom/shells` | — |
| Vector group | група з’єднань | напр. Dyn11 | — | Схеми обмоток і зсув фаз (година = 30°). | `transformer/three-phase-groups` | — |
| Ventricular fibrillation | фібриляція шлуночків | — | — | Небезпечне порушення ритму серця | `home/shock` | — |
| VFD | частотний перетворювач | f | Hz | інвертор для керування двигуном | `lab-inverter/ups` | — |
| Volt | вольт | V | V | 1 V = 1 J/C. | `charge-field/potential` | — |
| Voltage | напруга | U | V | Різниця потенціалів, `U = W/q`. | `charge-field/potential` | `current` |
| Voltage class | клас напруги | U_ном | kV | Стандартне номінальне значення напруги мережі. | `transformer/voltage-ladder` | `transmission` |
| Voltage dip | провал напруги | — | — | Короткочасне зниження напруги. | `distribution/power-quality` | — |
| Voltage drop | спад напруги | ΔU | V, % | Втрата напруги вздовж лінії. | `distribution/lv-network` | `home` |
| Voltage monitoring relay | реле контролю напруги | — | — | Вимикає живлення, коли напруга виходить за задані межі. | `distribution/neutral-earthing` | — |
| Voltmeter / ammeter | вольтметр / амперметр | V, A | — | Паралельно / послідовно. | `current` | — |
| VPP | віртуальна електростанція | — | MW | об’єднані розподілені ресурси під спільним керуванням | `lab-hybrid-home/microgrid-finale` | — |
| VT | трансформатор напруги (ТН) | — | — | Вимірювальний, вторинна напруга 100 V. | `transformer/types` | — |
| Wafer | кремнієва пластина | — | mm, μm | основа комірки | `lab-pv/cell` | — |
| Wake | аеродинамічний слід | — | — | Смуга сповільненого турбулентного повітря за ротором | `plant-wind/wind-farm` | — |
| Water hammer | гідравлічний удар | Δp | MPa | Стрибок тиску при різкій зміні потоку. | `plant-hydro/water-path` | — |
| Water starting time | стала інерції води | T_w | s | Час розгону води у водоводі повним напором до номінальної швидкості. | `plant-hydro/generator-governor` | — |
| Water walls | екранні труби | — | — | Труби з водою, що утворюють стіни топки. | `plant-coal/boiler` | — |
| Wave power flux | потік енергії хвиль | P | kW/m | Потужність на метр фронту хвилі | `plant-ocean/waves` | — |
| Weibull distribution | розподіл Вейбулла | k, c | —, m/s | Статистика швидкостей вітру | `plant-wind/capacity-factor` | — |
| Wells turbine | турбіна Веллса | — | — | Повітряна турбіна, що обертається в один бік за реверсного потоку | `plant-ocean/wave-devices` | — |
| Wicket gates | напрямний апарат | — | % | Поворотні лопатки, що регулюють витрату. | `plant-hydro/water-path` | — |
| Wind farm | вітрова електростанція, ВЕС | — | — | Група турбін зі спільною збірною мережею і підстанцією | `plant-wind/overview` | — |
| Wind shear | вертикальний профіль вітру | α | — | Зростання швидкості вітру з висотою | `plant-wind/capacity-factor` | — |
| Wind turbine (WTG) | вітрова турбіна, ВЕУ | — | — | Машина, що перетворює енергію вітру на електричну | `plant-wind/overview` | — |
| WtE | енергетична утилізація відходів | — | — | Спалювання відходів з виробленням енергії | `plant-geo-bio/overview` | — |
| Yaw system | система орієнтації гондоли | — | ° | Поворот гондоли за напрямом вітру | `plant-wind/nacelle` | — |
| Zero export | нульовий експорт | — | — | режим без видачі в мережу | `lab-hybrid-home/single-line` | — |
