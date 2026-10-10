# سجل مطابقة الجزء D على المراجع

النص الكامل لـ SBC 401 وSBC 1101 وSBC 1102 غير منشور للعامة، فاعتُمد الكود الأم (NEC وIEC 60364 وIRC) عن طريق نصوص منقولة في وثائق جهات رسمية أو فنية معترف بها، وذُكر ذلك في كل سطر. صفحات ICC الرقمية لم تُعرض نصوصها عند الفتح، فلم تُذكر مصدراً.

| البند | القيمة | الحكم | المصدر |
|---|---|---|---|
| 26 05 00 | مقاطع الأسلاك وتيارات القواطع لكل دائرة (1.5/10، 2.5/16-20، 4/25، 6/32) | unsourced: أُحيلت إلى جدول الأحمال وجداول سعة التيار في SBC 401، وحُذفت الأرقام من specs والخيارات 01 إلى 04 | لا نص مفتوح |
| 26 05 00 | هبوط الجهد 3٪ للإنارة و5٪ لباقي الأحمال | confirmed_base | IEC 60364-5-52 الجدول G.52.1، [دليل التمديدات الكهربائية](https://www.electrical-installation.org/enwiki/Maximum_voltage_drop_limit) |
| 26 05 00 | قطر الماسورة 20 مم ونسبة الإشغال 40٪ | unsourced: أُحيل القطر ونسبة الإشغال إلى التصميم وSBC 401 | لا نص مفتوح |
| 26 05 26 | مقاومة الأرض 5 أوم | corrected: حسب التصميم ومتطلبات الشركة السعودية للكهرباء، ولا يُكتفى بقطب واحد فوق 25 أوم | NEC 250.53(A)(2)، [مجلة IAEI](https://iaeimagazine.org/magazine/2018/07/30/the-5-ft-ground-rod-and-its-little-known-use-in-the-nec/) |
| 26 05 26 | القطب 16 مم × 2.4 م | confirmed_base (15.87 مم × 2.44 م حداً أدنى) | NEC 250.52(A)(5)، [مجلة IAEI](https://iaeimagazine.org/magazine/2018/07/30/the-5-ft-ground-rod-and-its-little-known-use-in-the-nec/) |
| 26 05 26 | موصل التأريض الرئيسي 16 مم² | corrected: يتبع مقطع موصلات التغذية (S حتى 16، و16 حتى 35، وS/2 فوقها) | IEC 60364-5-54، [دليل التمديدات الكهربائية](https://www.electrical-installation.org/enwiki/Sizing_of_protective_earthing_conductor) |
| 26 05 26 | موصل الربط متساوي الجهد 6 مم² | confirmed_base | IEC 60364-5-54، [دليل التمديدات الكهربائية](https://www.electrical-installation.org/enwiki/Equipotential_conductor) |
| 26 24 16 | ارتفاع أعلى قاطع 1.8 م | unsourced: أُحيل إلى المخططات | لا نص مفتوح |
| 26 24 16 | سعة القطع 6 و10 كيلو أمبير | unsourced: أُحيلت إلى حساب تيار القصر عند موضع اللوحة | نطاق [IEC 60898-1:2015](https://www.technickenormy.cz/publicdoc/iec_previews/115624.pdf) حتى 25 كيلو أمبير دون القيم القياسية |
| 26 24 16 | ملاءمة IEC 61439-3 | confirmed_base: تغطي لوحات غير المختصين حتى 300 فولت إلى الأرض و125 أمبير للمخرج | [IEC 61439-3:2024](https://webstore.iec.ch/publication/68496) |
| 26 24 16 | سطر السعر «طبلون توزيع 24 خط» | ليس قيمة فنية: نُقل إلى issues | |
| 26 27 26 | ارتفاعات 120 و30 و110 سم | unsourced: أُحيلت إلى جدول الارتفاعات في المخططات | لا نص مفتوح |
| 26 27 26 | 60 سم من حوض الاستحمام أو الدش | confirmed_base: النطاق 2 يمتد 0.6 م، والمقابس خارجه بحماية 30 ملي أمبير | IEC 60364-7-701، [هيئة المهندسين في هونغ كونغ](https://hkie.org.hk/el/wp-content/uploads/sites/9/hkie/c8bf338da94b89b236d21745057ffeca/DocDown.aspximgDoc21_Electrical%20blog%20No.%2013%20-%20Bathroom%20Socket.pdf) |
| 26 27 26 | موصل المحايد للمفاتيح الذكية | ليس قيمة فنية: نُقل إلى issues | |
| 26 51 00 | الكفاءة الضوئية 80 لومن/واط | unsourced: أُحيلت إلى فئة بطاقة الكفاءة، وحُذفت من الخيار 01 ومن 26 56 00-01 | لا نص مفتوح لـ SASO 2870 وSASO 2902 |
| 26 51 00 | معامل القدرة 0.9 لـ 10 واط فأكثر | corrected: 0.5 فوق 5 واط، و0.7 فوق 10 واط، و0.9 فوق 25 واط | [لائحة التصميم البيئي الأوروبية 2019/2020 الملحق II](https://legislation.gov.uk/eur/2019/2020/annex/II/division/2/2020-01-31/data.xht) |
| 26 51 00 | عمر L70 بقيم 25,000 و35,000 و50,000 ساعة | unsourced: أُحيل إلى بيانات المصنع، وحُذف من الخيارات الثلاثة (تبقى مميزة بمؤشر اللون والوهج والتعتيم والتشتت) | لا نص مفتوح |
| 26 51 00 | مؤشر تجسيد اللون 80 حداً أدنى | confirmed_base (دولي) | [لائحة التصميم البيئي الأوروبية 2019/2020](https://legislation.gov.uk/eur/2019/2020/annex/II/division/2/2020-01-31/data.xht) |
| 26 51 00 | نطاق SASO 2902 وانطباقها على وحدات الإنارة | confirmed_sa: الجزء الثاني يغطي وحدات الإنارة مع إعفاءات، والمواصفتان إلزاميتان عبر لائحة كفاءة الطاقة؛ صيغ البند بعبارة «فيما ينطبق» | [عرض SASO 2902](https://saso.gov.sa/ar/mediacenter/events/Documents/Update-Lighting-part2-standard-SASO2902-v2-22-08-2024.pdf)، [إيضاح SASO](https://saso.gov.sa/en/mediacenter/news/Pages/saso_news_909.aspx) |
| 26 56 00 | عمق دفن 50 سم | corrected: غطاء لا يقل عن 45 سم فوق الماسورة غير المعدنية | NEC 300.5، [بلدية Colleyville](https://colleyville.com/home/showpublisheddocument/126/636039493188130000) |
| 26 56 00 | حرارة محيطة 50 °م | unsourced: أُحيلت إلى تقنين ta لدى المصنع | لا نص مفتوح |
| 27 15 00 | فصل 30 سم عن مواسير القوى | unsourced: أُحيل إلى التصميم وتوصية المصنع | لا نص مفتوح |
| 27 15 00 | قطر ماسورة 25 مم | unsourced: أُحيل إلى التصميم | لا نص مفتوح |
| 27 51 23 | مركز الوحدة الخارجية 150 سم | unsourced: أُحيل إلى المخططات | لا نص مفتوح |
| 28 23 00 | مدة التخزين 30 و14 يوماً | unsourced: أُحيلت إلى جدول المتطلبات | اللائحة لا تتناول المساكن |
| 28 23 00 | مدى الرؤية الليلية 20 و30 م | unsourced: أُحيل إلى مخطط التغطية، وحُذف من الخيارين 01 و02 | لا نص مفتوح |
| 28 23 00 | حرارة تشغيل 50 °م | unsourced: أُحيلت إلى بيانات المصنع | لا نص مفتوح |
| 28 23 00 | الاشتراطات النظامية للكاميرات | confirmed_sa: اللائحة التنفيذية تخص المنشآت المحددة ولا تذكر المساكن، وصيغة «مراعاة الأنظمة السارية» كافية | [اللائحة التنفيذية لنظام استخدام كاميرات المراقبة الأمنية، أم القرى](https://www.uqn.gov.sa/details?p=23050) |
| 28 31 00 | مواقع كواشف الدخان والربط البيني | confirmed_base | IRC R314.3 وR314.4 وR314.6، [مقاطعة Anne Arundel](https://www.aacounty.org/sites/default/files/2023-08/SmokeDetectRequire.pdf) |
| 28 31 00 | 0.9 م من باب الحمام و1.8 م من جهاز الطبخ للكهروضوئي | confirmed_base (3 أقدام و6 أقدام) | IRC R314.3 وR314.3.1، [مقاطعة Anne Arundel](https://www.aacounty.org/sites/default/files/2023-08/SmokeDetectRequire.pdf) |
| 28 31 00 | اشتراط كاشف أول أكسيد الكربون | confirmed_base: جهاز احتراق بالوقود أو مرآب ملاصق له منفذ، خارج كل منطقة نوم وداخل الغرفة إن كان فيها جهاز احتراق؛ أُضيف الشرطان إلى النص | IRC R315.2.1 وR315.3، [ICC](https://www.iccsafe.org/wp-content/uploads/bcac/IRC-R315.pdf)، [مقاطعة Anne Arundel](https://www.aacounty.org/sites/default/files/2023-08/CARBON%20MONOXIDE%20ALARMS.pdf) |
| 28 31 00 | قبول EN 14604 وUL 217 وEN 50291 وUL 2034 | confirmed_base: UL 217 وUL 2034 في IRC، وEN 14604 وEN 50291-1 مواصفتا المساكن؛ صُحح الرمز إلى EN 50291-1 | [ICC](https://www.iccsafe.org/wp-content/uploads/bcac/IRC-R315.pdf)، [SIS](https://www.sis.se/produkter/miljo-och-halsoskydd-sakerhet/skydd-mot-brand/brandskydd/ssen146042005/)، [BSI](https://knowledge.bsigroup.com/products/electrical-apparatus-for-the-detection-of-carbon-monoxide-in-domestic-premises-test-methods-and-performance-requirements-1) |
| 32 14 13 | سماكة طبقة الأساس 15 سم | unsourced: أُحيلت إلى التصميم | لا نص مفتوح |
| 32 14 13 | استواء 10 مم تحت قدة 3 م | confirmed_base (±10 مم) | [مركز أبحاث الرصف، جامعة كاليفورنيا دافيس](https://www.ucprc.ucdavis.edu/ccpic/PDF/2022/ICP%20Guidance%20for%20CCPIC%20(1-04-22).pdf) |
| 32 14 13 | فرق منسوب 3 مم بين البلاطات | unsourced: أُحيل إلى توصية المصنع | لا نص مفتوح |
| 32 14 13 | الحجر 3 سم للمشاة و5 سم للسيارات | unsourced: أُحيلت إلى التصميم في الخيار 03 | لا نص مفتوح |
| 32 14 13 | مقطع البردورات 15×30 سم | unsourced: أُحيل المقطع إلى المخططات في الخيار 04 | لا نص مفتوح |
| 32 31 00 | أعمدة التقوية كل 3.5 م | unsourced: أُحيلت إلى التصميم الإنشائي، ومنها الخيار 01 | لا نص مفتوح |
| 32 31 00 | فواصل التمدد كل 12 م | corrected: فواصل تحكم لا تتجاوز 7.6 م | NCMA TEK 10-02، [مجلس الاستشارات للبناء بالحجر](https://masonryadvisorycouncil.org/wp-content/uploads/2021/05/8-Movement-Joints-article.pdf) |
| 32 31 00 | سماكة الدهان الجاف 120 ميكرون | unsourced: أُحيلت إلى توصية المصنع، ومنها الخيار 02 | لا نص مفتوح |
| 32 31 00 | حدود ارتفاع السور | confirmed_sa: البند يحيل إلى اشتراطات البلدية دون رقم | [اشتراطات إنشاء المباني السكنية 1446هـ](https://aleqt.com/sites/default/files/pictures/July/271/2024/ashtratat_ansha_almbany_alsknyt_m_alqrar.pdf) |
| 32 84 00 | ملاءمة ISO 9261 وISO 4427 | confirmed_base: الأولى للنقاطات حتى 24 لتراً/ساعة، والثانية لمواسير PE تحت الضغط ومعتمدة خليجياً | [BSI](https://knowledge.bsigroup.com/products/agricultural-irrigation-equipment-emitters-and-emitting-pipe-specification-and-test-methods)، [GSO ISO 4427-1](https://ysmo.gso.org.sa/store/standards/GSO:1064931?lang=en) |
| 32 84 00 | عمق الدفن 30 سم | unsourced: أُحيل إلى مخطط الري | لا نص مفتوح |
| 32 84 00 | مدة اختبار الضغط ساعتان | unsourced: أُحيلت إلى المواصفات المعتمدة | لا نص مفتوح |
| 32 90 00 | ملوحة التربة 4 ديسي سيمنز/م | confirmed_base: هو الحد الأدنى للتربة الملحية | [قاموس وزارة الزراعة الأمريكية](https://lod.nal.usda.gov/nalt/24692) |
| 32 90 00 | السماد العضوي 20٪ | unsourced: أُحيل إلى مواصفات التنسيق | لا نص مفتوح |
| 32 90 00 | الصيانة 90 يوماً | unsourced: أُحيلت إلى العقد | لا نص مفتوح |
| 32 90 00 | ارتفاع الأشجار 2.5 و3.5 م | unsourced: أُحيل إلى مخطط التنسيق، ومنه الخياران 02 و03 | لا نص مفتوح |

## الحصيلة
confirmed_sa: 3، confirmed_base: 13، corrected: 5، unsourced: 25، غير فني نُقل إلى issues: 2. حقل `verify` فارغ في كل البنود الأربعة عشر.
