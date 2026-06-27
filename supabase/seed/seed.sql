-- MedServicePrice.kz — Phase 1 — Catalog seed
-- EXACTLY 4 categories (the canonical enum): Лаборатория · Приём врача ·
-- Диагностика · Процедура. 78 normalized services, each with Russian +
-- abbreviation synonyms to power trigram normalization. Above the TZ bar (50+).
-- Idempotent: safe to re-run (on conflict (slug) do nothing).

-- ===========================================================================
-- CATEGORIES (the four canonical values)
-- ===========================================================================
insert into service_categories (name, slug, icon, sort_order) values
  ('Лаборатория',  'laboratoriya', 'test-tube',    1),
  ('Приём врача',  'priem-vracha', 'stethoscope',  2),
  ('Диагностика',  'diagnostika',  'scan',         3),
  ('Процедура',    'procedura',    'syringe',      4)
on conflict (slug) do nothing;

-- ===========================================================================
-- ЛАБОРАТОРИЯ — анализы крови, гормоны, моча и кал, инфекции
-- ===========================================================================
insert into services_catalog (canonical_name, slug, category_id, synonyms)
select v.canonical_name, v.slug,
       (select id from service_categories where slug = 'laboratoriya'),
       v.synonyms
from (values
  -- анализы крови
  ('Общий анализ крови',                'oak',                     array['ОАК','CBC','клинический анализ крови','общий анализ крови']),
  ('Общий анализ крови с лейкоформулой','oak-leykoformula',        array['ОАК с лейкоцитарной формулой','клинический анализ крови развернутый']),
  ('Биохимический анализ крови',        'biohimiya-krovi',         array['биохимия крови','биохимия','BIO']),
  ('Глюкоза',                           'glyukoza',                array['сахар крови','глюкоза крови','glucose']),
  ('Гликированный гемоглобин',          'glikirovannyy-gemoglobin',array['HbA1c','гликогемоглобин']),
  ('Липидный профиль',                  'lipidnyy-profil',         array['липидограмма','холестерин общий','lipid panel']),
  ('Коагулограмма',                     'koagulogramma',           array['гемостазиограмма','свертываемость крови']),
  ('СОЭ',                               'soe',                     array['скорость оседания эритроцитов','ESR']),
  ('Группа крови и резус фактор',       'gruppa-krovi',            array['группа крови','резус фактор','blood type']),
  ('Ферритин',                          'ferritin',                array['ferritin']),
  ('Сывороточное железо',               'zhelezo',                 array['железо','iron','Fe']),
  ('Витамин D',                         'vitamin-d',               array['25-OH витамин D','витамин Д','25(OH)D']),
  ('Витамин B12',                       'vitamin-b12',             array['цианокобаламин','B12']),
  ('C реактивный белок',                'c-reaktivnyy-belok',      array['СРБ','CRP']),
  ('Печеночные пробы',                  'pechenochnye-proby',      array['АЛТ','АСТ','билирубин','печеночный профиль']),
  ('Электролиты крови',                 'elektrolity',             array['калий','натрий','хлор','electrolytes']),
  ('Креатинин',                         'kreatinin',               array['creatinine']),
  ('Мочевина',                          'mochevina',               array['urea']),
  -- гормоны
  ('ТТГ',                'ttg',           array['тиреотропный гормон','TSH','тиротропин']),
  ('Т4 свободный',       't4-svobodnyy',  array['свободный тироксин','FT4','тироксин свободный']),
  ('Т3 свободный',       't3-svobodnyy',  array['свободный трийодтиронин','FT3']),
  ('Пролактин',          'prolaktin',     array['prolactin']),
  ('Кортизол',           'kortizol',      array['cortisol']),
  ('Тестостерон общий',  'testosteron',   array['тестостерон','testosterone']),
  ('Эстрадиол',          'estradiol',     array['estradiol','E2']),
  ('Прогестерон',        'progesteron',   array['progesterone']),
  ('ФСГ',                'fsg',           array['фолликулостимулирующий гормон','FSH']),
  ('ЛГ',                 'lg',            array['лютеинизирующий гормон','LH']),
  ('ХГЧ',                'hgch',          array['хорионический гонадотропин','beta-HCG','ХГЧ бета']),
  ('Инсулин',            'insulin',       array['insulin']),
  ('Антитела к ТПО',     'at-tpo',        array['АТ-ТПО','anti-TPO','антитела к тиреопероксидазе']),
  -- моча и кал
  ('Общий анализ мочи',           'oam',                array['ОАМ','анализ мочи','urinalysis']),
  ('Анализ мочи по Нечипоренко',  'mocha-nechiporenko', array['проба Нечипоренко']),
  ('Суточный анализ мочи',        'mocha-sutochnaya',   array['суточная моча']),
  ('Копрограмма',                 'koprogramma',        array['анализ кала','общий анализ кала']),
  ('Кал на скрытую кровь',        'kal-skrytaya-krov',  array['скрытая кровь в кале','occult blood']),
  ('Соскоб на энтеробиоз',        'soskob-enterobioz',  array['энтеробиоз','яйца глист']),
  -- инфекции
  ('Анализ на ВИЧ',         'vich',           array['ВИЧ','HIV','anti-HIV']),
  ('Гепатит B (HBsAg)',     'gepatit-b',      array['HBsAg','гепатит B']),
  ('Гепатит C (anti-HCV)',  'gepatit-c',      array['anti-HCV','гепатит C']),
  ('Сифилис (RW)',          'sifilis-rw',     array['RW','реакция Вассермана','RPR','сифилис']),
  ('ПЦР на COVID 19',       'pcr-covid',      array['ПЦР коронавирус','SARS-CoV-2 ПЦР','covid тест']),
  ('Антитела к COVID 19',   'antitela-covid', array['IgG covid','антитела коронавирус'])
) as v(canonical_name, slug, synonyms)
on conflict (slug) do nothing;

-- ===========================================================================
-- ПРИЁМ ВРАЧА
-- ===========================================================================
insert into services_catalog (canonical_name, slug, category_id, synonyms)
select v.canonical_name, v.slug,
       (select id from service_categories where slug = 'priem-vracha'),
       v.synonyms
from (values
  ('Приём терапевта',         'priem-terapevta',        array['терапевт','консультация терапевта']),
  ('Приём гинеколога',        'priem-ginekologa',       array['гинеколог','консультация гинеколога']),
  ('Приём отоларинголога',    'priem-lor',              array['ЛОР','отоларинголог','лор врач']),
  ('Приём кардиолога',        'priem-kardiologa',       array['кардиолог']),
  ('Приём невролога',         'priem-nevrologa',        array['невролог','невропатолог']),
  ('Приём дерматолога',       'priem-dermatologa',      array['дерматолог','дерматовенеролог']),
  ('Приём уролога',           'priem-urologa',          array['уролог']),
  ('Приём эндокринолога',     'priem-endokrinologa',    array['эндокринолог']),
  ('Приём офтальмолога',      'priem-oftalmologa',      array['офтальмолог','окулист']),
  ('Приём хирурга',           'priem-hirurga',          array['хирург']),
  ('Приём педиатра',          'priem-pediatra',         array['педиатр','детский врач']),
  ('Приём гастроэнтеролога',  'priem-gastroenterologa', array['гастроэнтеролог'])
) as v(canonical_name, slug, synonyms)
on conflict (slug) do nothing;

-- ===========================================================================
-- ДИАГНОСТИКА — УЗИ, рентген, КТ, МРТ, ЭКГ, эндоскопия
-- ===========================================================================
insert into services_catalog (canonical_name, slug, category_id, synonyms)
select v.canonical_name, v.slug,
       (select id from service_categories where slug = 'diagnostika'),
       v.synonyms
from (values
  ('УЗИ брюшной полости',     'uzi-bryushnoy-polosti', array['УЗИ ОБП','узи живота']),
  ('УЗИ органов малого таза', 'uzi-malogo-taza',       array['УЗИ ОМТ','узи матки']),
  ('УЗИ щитовидной железы',   'uzi-shchitovidnoy',     array['УЗИ щитовидки']),
  ('УЗИ молочных желёз',      'uzi-molochnyh-zhelez',  array['УЗИ груди']),
  ('УЗИ почек',               'uzi-pochek',            array['узи почек и надпочечников']),
  ('Эхокардиография',         'ehokardiografiya',      array['УЗИ сердца','ЭхоКГ','echo']),
  ('УЗИ при беременности',    'uzi-beremennost',       array['скрининг беременности','фетометрия']),
  ('УЗДГ сосудов',            'uzdg-sosudov',          array['допплерография','УЗИ сосудов']),
  ('ЭКГ',                     'ekg',                   array['электрокардиография','ECG']),
  ('Холтер ЭКГ',              'holter-ekg',            array['суточное мониторирование ЭКГ','холтеровское мониторирование']),
  ('Рентген грудной клетки',  'rentgen-grudnoy-kletki',array['рентген ОГК','флюорография']),
  ('Маммография',             'mammografiya',          array['mammography']),
  ('КТ',                      'kt',                    array['компьютерная томография','CT']),
  ('МРТ',                     'mrt',                   array['магнитно резонансная томография','MRI']),
  ('Гастроскопия',            'gastroskopiya',         array['ФГДС','ФГС','эзофагогастродуоденоскопия']),
  ('Колоноскопия',            'kolonoskopiya',         array['colonoscopy','ФКС'])
) as v(canonical_name, slug, synonyms)
on conflict (slug) do nothing;

-- ===========================================================================
-- ПРОЦЕДУРА — инъекции, капельницы, манипуляции
-- ===========================================================================
insert into services_catalog (canonical_name, slug, category_id, synonyms)
select v.canonical_name, v.slug,
       (select id from service_categories where slug = 'procedura'),
       v.synonyms
from (values
  ('Внутримышечная инъекция', 'vnutrimyshechnaya-inekciya', array['укол внутримышечно','в/м инъекция','внутримышечный укол']),
  ('Внутривенная инъекция',   'vnutrivennaya-inekciya',     array['укол внутривенно','в/в инъекция','внутривенный укол']),
  ('Капельница',              'kapelnica',                  array['внутривенное капельное введение','в/в капельно','инфузия']),
  ('Забор крови из вены',     'zabor-krovi-iz-veny',        array['взятие крови','венепункция','забор венозной крови']),
  ('Перевязка',               'perevyazka',                 array['смена повязки']),
  ('Снятие швов',             'snyatie-shvov',              array['удаление швов']),
  ('Промывание уха',          'promyvanie-uha',             array['туалет уха','удаление серной пробки'])
) as v(canonical_name, slug, synonyms)
on conflict (slug) do nothing;
