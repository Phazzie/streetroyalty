/**
 * Printful's cut pieces for the three all-over garments, traced from the v2
 * mockup-templates images (role "template") on 2026-11-19. Generated data: do not
 * hand-edit. Units are template units: every template sheet is 3000 x 3000.
 * See docs/printful-aop-data.md, "Traced piece outlines".
 */
import type { GarmentOutline } from "./types.ts";

export const OUTLINES = {
  "aop-hoodie": {
    templateId: "aop-hoodie",
    printer: "printful",
    placements: [
      {
        placement: "front",
        printInches: [40, 40],
        printArea: { left: 182, top: -14, width: 2636, height: 2636 },
        templateImage:
          "https://files.cdn.printful.com/m/all-over-unisex-hoodie/medium/template2/front_image.png",
        pieces: [
          {
            id: "body_front",
            title: "Front body",
            bbox: [414, 12, 2175, 2073],
            path: "M564 159 L567 540 L552 696 L528 804 L504 873 L462 942 L408 990 L420 2088 L2577 2088 L2592 990 L2544 951 L2508 900 L2472 810 L2457 735 L2451 723 L2436 621 L2430 531 L2433 156 L1836 6 L1818 6 L1794 87 L1761 159 L1731 201 L1680 252 L1650 273 L1587 300 L1536 309 L1461 309 L1410 300 L1359 279 L1326 258 L1278 213 L1236 156 L1215 114 L1182 9 L1164 6 Z",
          },
          {
            id: "waistband_front",
            title: "Waistband, front half (folded band)",
            bbox: [456, 2151, 2091, 402],
            path: "M456 2151 L2547 2151 L2547 2553 L456 2553 Z",
          },
        ],
      },
      {
        placement: "back",
        printInches: [40, 40],
        printArea: { left: 180, top: 0, width: 2640, height: 2633 },
        templateImage:
          "https://files.cdn.printful.com/m/all-over-unisex-hoodie/medium/template2/back_image.png",
        pieces: [
          {
            id: "body_back",
            title: "Back body",
            bbox: [414, 24, 2175, 2070],
            path: "M564 165 L567 435 L564 597 L555 693 L528 804 L498 891 L462 954 L429 984 L408 996 L420 2097 L2577 2097 L2592 999 L2565 981 L2529 945 L2511 915 L2472 810 L2448 723 L2439 663 L2433 567 L2433 165 L1851 18 L1824 18 L1794 39 L1719 72 L1611 90 L1389 90 L1332 84 L1245 60 L1176 18 L1149 18 Z",
          },
          {
            id: "waistband_back",
            title: "Waistband, back half (folded band)",
            bbox: [456, 2163, 2091, 399],
            path: "M456 2163 L2547 2163 L2547 2562 L456 2562 Z",
          },
        ],
      },
      {
        placement: "hood",
        printInches: [40, 40],
        printArea: { left: 0, top: 0, width: 3000, height: 3000 },
        templateImage:
          "https://files.cdn.printful.com/m/all-over-unisex-hoodie/medium/template2/hood_image.png",
        pieces: [
          {
            id: "hood_1",
            title: "Hood piece, top left on the sheet",
            bbox: [84, 21, 1377, 1449],
            path: "M447 18 L450 636 L432 921 L405 1065 L390 1110 L372 1146 L318 1224 L270 1281 L186 1365 L78 1461 L78 1473 L441 1473 L564 1467 L699 1452 L924 1407 L1053 1389 L1251 1377 L1422 1374 L1431 1266 L1434 1137 L1458 822 L1464 555 L1455 441 L1440 372 L1407 297 L1380 255 L1332 201 L1257 147 L1167 102 L1035 57 L933 36 L810 24 L525 15 Z",
          },
          {
            id: "hood_2",
            title: "Hood piece, top right on the sheet",
            bbox: [1545, 21, 1374, 1449],
            path: "M2556 18 L2478 15 L2190 24 L2070 36 L1956 60 L1842 99 L1740 150 L1680 192 L1620 258 L1587 312 L1563 369 L1548 435 L1539 531 L1542 780 L1566 1200 L1581 1377 L1818 1380 L1944 1389 L2091 1410 L2319 1455 L2436 1467 L2556 1473 L2922 1473 L2922 1461 L2829 1377 L2724 1272 L2637 1158 L2616 1119 L2598 1068 L2580 987 L2568 900 L2553 660 Z",
          },
          {
            id: "hood_3",
            title: "Hood piece, bottom left on the sheet",
            bbox: [87, 1497, 1374, 1449],
            path: "M447 1491 L450 2112 L432 2394 L420 2475 L402 2550 L375 2616 L315 2703 L264 2763 L201 2826 L81 2934 L81 2946 L414 2949 L552 2943 L675 2931 L903 2886 L1047 2865 L1164 2856 L1419 2850 L1425 2835 L1434 2613 L1458 2298 L1464 2031 L1455 1917 L1440 1848 L1404 1767 L1380 1731 L1323 1668 L1248 1617 L1176 1581 L1038 1533 L936 1512 L822 1500 L606 1491 Z",
          },
          {
            id: "hood_4",
            title: "Hood piece, bottom right on the sheet",
            bbox: [1545, 1497, 1374, 1449],
            path: "M2556 1491 L2397 1491 L2181 1500 L2064 1512 L1953 1536 L1833 1578 L1749 1620 L1683 1665 L1626 1725 L1593 1776 L1563 1845 L1548 1911 L1539 2007 L1542 2256 L1566 2676 L1581 2850 L1836 2856 L1953 2865 L2097 2886 L2286 2925 L2409 2940 L2589 2949 L2922 2946 L2922 2934 L2817 2841 L2730 2754 L2673 2685 L2634 2628 L2610 2580 L2595 2532 L2571 2403 L2553 2136 Z",
          },
        ],
      },
      {
        placement: "pocket",
        printInches: [40, 40],
        printArea: { left: 0, top: 0, width: 3000, height: 3000 },
        templateImage:
          "https://files.cdn.printful.com/m/all-over-unisex-hoodie/medium/template2/pocket-image.png",
        pieces: [
          {
            id: "pocket",
            title: "Kangaroo pocket",
            bbox: [633, 1065, 1737, 873],
            path: "M627 1743 L630 1941 L2373 1938 L2370 1734 L1923 1059 L1077 1059 Z",
          },
        ],
      },
      {
        placement: "label_panel",
        printInches: [40, 40],
        printArea: { left: 0, top: 0, width: 3000, height: 3000 },
        templateImage:
          "https://files.cdn.printful.com/m/all-over-unisex-hoodie/medium/template2/label_panel_mockup-gen.png",
        pieces: [
          {
            id: "label_panel",
            title: "Back-neck label panel",
            bbox: [1113, 1230, 777, 546],
            path: "M1893 1224 L1881 1224 L1824 1251 L1749 1272 L1632 1287 L1329 1284 L1212 1263 L1158 1245 L1122 1227 L1107 1227 L1107 1251 L1137 1410 L1173 1527 L1206 1599 L1245 1659 L1290 1707 L1326 1734 L1365 1755 L1398 1767 L1458 1779 L1542 1779 L1590 1770 L1668 1737 L1701 1713 L1746 1668 L1776 1626 L1815 1551 L1848 1458 L1875 1347 Z",
          },
        ],
      },
      {
        placement: "sleeve_left",
        printInches: [40, 40],
        printArea: { left: 0, top: 0, width: 3000, height: 3000 },
        templateImage:
          "https://files.cdn.printful.com/m/all-over-unisex-hoodie/medium/template2/left_sleeve_image.png",
        pieces: [
          {
            id: "sleeve_left",
            title: "Left sleeve",
            bbox: [543, 285, 1917, 1914],
            path: "M546 645 L537 654 L537 672 L663 1122 L744 1362 L816 1596 L1038 2199 L1956 2202 L2124 1755 L2220 1479 L2238 1410 L2361 1035 L2394 900 L2415 834 L2415 816 L2421 813 L2460 675 L2463 651 L2238 507 L2010 393 L1887 345 L1773 309 L1689 291 L1584 279 L1413 279 L1350 285 L1236 306 L1110 345 L960 405 L819 474 L696 546 Z",
          },
          {
            id: "cuff_left",
            title: "Left cuff (folded band)",
            bbox: [1107, 2262, 786, 453],
            path: "M1107 2262 L1893 2262 L1893 2715 L1107 2715 Z",
          },
        ],
      },
      {
        placement: "sleeve_right",
        printInches: [40, 40],
        printArea: { left: 0, top: 0, width: 3000, height: 3000 },
        templateImage:
          "https://files.cdn.printful.com/m/all-over-unisex-hoodie/medium/template2/right_sleeve_image.png",
        pieces: [
          {
            id: "sleeve_right",
            title: "Right sleeve",
            bbox: [543, 285, 1917, 1914],
            path: "M537 654 L537 672 L588 843 L633 1023 L750 1380 L780 1488 L831 1638 L1038 2199 L1959 2202 L2202 1536 L2238 1410 L2361 1035 L2382 945 L2415 834 L2415 816 L2421 813 L2463 666 L2463 651 L2238 507 L2010 393 L1887 345 L1773 309 L1689 291 L1584 279 L1413 279 L1350 285 L1263 300 L1110 345 L960 405 L825 471 L696 546 Z",
          },
          {
            id: "cuff_right",
            title: "Right cuff (folded band)",
            bbox: [1107, 2262, 786, 453],
            path: "M1107 2262 L1893 2262 L1893 2715 L1107 2715 Z",
          },
        ],
      },
    ],
    labels: [{ placement: "label_inside", printInches: [2.5, 1] }],
  },
  "aop-joggers": {
    templateId: "aop-joggers",
    printer: "printful",
    placements: [
      {
        placement: "leg_left",
        printInches: [33, 50],
        printArea: { left: 510, top: 0, width: 1978, height: 3000 },
        templateImage:
          "https://files.cdn.printful.com/m/all-over-mens-joggers/medium/template1/No_text_mens_joggers_LEFT_leg_no-text.png",
        pieces: [
          {
            id: "waistband_left",
            title: "Waistband, left half",
            bbox: [678, 102, 1605, 153],
            path: "M2286 96 L690 123 L672 126 L672 234 L675 258 L804 258 L2286 231 Z",
          },
          {
            id: "leg_left",
            title: "Left leg, front and back in one piece",
            bbox: [567, 240, 1869, 2259],
            path: "M2286 234 L675 261 L681 744 L672 858 L660 903 L645 933 L618 969 L561 1020 L561 1035 L612 1122 L714 1332 L771 1470 L828 1635 L933 2028 L990 2277 L1035 2502 L1350 2481 L1503 2481 L1842 2502 L1857 2499 L1896 2298 L1956 2049 L2007 1881 L2052 1767 L2121 1614 L2226 1416 L2358 1206 L2439 1098 L2439 1086 L2400 1059 L2361 1020 L2337 987 L2322 957 L2304 891 L2292 792 L2292 483 Z",
          },
          {
            id: "cuff_left",
            title: "Left cuff (folded band)",
            bbox: [1101, 2616, 699, 336],
            path: "M1101 2616 L1800 2616 L1800 2952 L1101 2952 Z",
          },
        ],
      },
      {
        placement: "leg_right",
        printInches: [33, 50],
        printArea: { left: 510, top: 0, width: 1978, height: 3000 },
        templateImage:
          "https://files.cdn.printful.com/m/all-over-mens-joggers/medium/template1/No_text_mens_joggers_RIGHT_leg_no-text.png",
        pieces: [
          {
            id: "waistband_right",
            title: "Waistband, right half",
            bbox: [717, 102, 1605, 153],
            path: "M714 96 L711 231 L2325 258 L2325 126 L2310 123 Z",
          },
          {
            id: "leg_right",
            title: "Right leg, front and back in one piece",
            bbox: [567, 240, 1866, 2259],
            path: "M711 234 L708 762 L696 882 L684 936 L663 984 L627 1032 L561 1086 L561 1101 L636 1200 L774 1419 L822 1506 L873 1614 L882 1620 L882 1629 L945 1764 L990 1878 L1035 2022 L1095 2265 L1143 2502 L1497 2481 L1650 2481 L1962 2502 L2058 2058 L2118 1821 L2175 1620 L2226 1473 L2295 1308 L2388 1119 L2436 1038 L2436 1020 L2370 957 L2355 936 L2337 900 L2325 849 L2319 792 L2319 516 L2325 261 Z",
          },
          {
            id: "cuff_right",
            title: "Right cuff (folded band)",
            bbox: [1203, 2616, 696, 336],
            path: "M1203 2616 L1899 2616 L1899 2952 L1203 2952 Z",
          },
        ],
      },
    ],
    labels: [{ placement: "label_inside", printInches: [2.5, 1] }],
  },
  "aop-track-jacket": {
    templateId: "aop-track-jacket",
    printer: "printful",
    placements: [
      {
        placement: "back",
        printInches: [44, 46],
        printArea: { left: 122, top: 59, width: 2756, height: 2882 },
        templateImage:
          "https://files.cdn.printful.com/m/all_over_print_recycled_unisex_track_jacket/medium/templates/back_notext.png",
        pieces: [
          {
            id: "collar_back_sheet",
            title: "Collar layer printed on the back sheet",
            bbox: [732, 153, 1539, 327],
            path: "M726 417 L726 447 L858 474 L948 483 L1041 480 L1287 441 L1494 432 L1497 420 L1500 432 L1632 435 L1737 444 L1932 477 L1992 483 L2049 483 L2139 474 L2274 447 L2229 162 L2142 171 L1938 165 L1821 153 L1671 147 L1326 147 L1176 153 L1059 165 L936 171 L855 171 L768 162 Z",
          },
          {
            id: "body_back",
            title: "Back body",
            bbox: [426, 555, 2151, 1827],
            path: "M687 705 L681 891 L666 1062 L642 1209 L612 1317 L588 1368 L570 1395 L543 1422 L507 1440 L420 1455 L420 1521 L468 2385 L2529 2385 L2580 1455 L2490 1440 L2454 1422 L2427 1395 L2409 1368 L2382 1308 L2349 1179 L2328 1035 L2313 834 L2310 702 L1788 549 L1767 549 L1716 579 L1692 585 L1545 594 L1329 588 L1275 576 L1230 549 L1209 549 L696 699 Z",
          },
          {
            id: "hem_back",
            title: "Back hem band (folded)",
            bbox: [531, 2466, 1938, 459],
            path: "M531 2466 L2469 2466 L2469 2925 L531 2925 Z",
          },
        ],
      },
      {
        placement: "details",
        printInches: [44, 46],
        printArea: { left: 122, top: 59, width: 2756, height: 2882 },
        templateImage:
          "https://files.cdn.printful.com/m/all_over_print_recycled_unisex_track_jacket/medium/templates/details_notext.png",
        pieces: [
          {
            id: "collar_details_sheet",
            title: "Collar layer printed on the details sheet",
            bbox: [1020, 105, 960, 405],
            path: "M1014 183 L1020 207 L1095 309 L1143 360 L1209 414 L1266 450 L1329 480 L1383 498 L1458 513 L1542 513 L1593 504 L1662 483 L1743 444 L1821 390 L1893 321 L1983 198 L1980 180 L1803 99 L1788 99 L1761 117 L1725 132 L1644 141 L1314 138 L1275 132 L1209 99 L1194 99 Z",
          },
          {
            id: "zip_facing_a",
            title: "Zip facing, left on the sheet",
            bbox: [996, 540, 498, 1842],
            path: "M1215 534 L990 612 L990 630 L1005 660 L1044 768 L1098 945 L1137 1140 L1170 1371 L1170 2385 L1497 2385 L1497 804 L1452 801 L1386 786 L1335 762 L1311 744 L1284 714 L1260 666 L1245 615 L1233 537 Z",
          },
          {
            id: "zip_facing_b",
            title: "Zip facing, right on the sheet",
            bbox: [1533, 540, 498, 1842],
            path: "M1806 534 L1791 534 L1782 600 L1761 672 L1743 708 L1719 738 L1683 765 L1653 780 L1590 798 L1527 804 L1527 2385 L1854 2385 L1854 1365 L1878 1191 L1917 981 L1947 867 L1998 714 L2031 636 L2034 615 Z",
          },
        ],
      },
      {
        placement: "front",
        printInches: [44, 46],
        printArea: { left: 122, top: 59, width: 2756, height: 2882 },
        templateImage:
          "https://files.cdn.printful.com/m/all_over_print_recycled_unisex_track_jacket/medium/templates/front_notext.png",
        pieces: [
          {
            id: "collar_front_sheet",
            title: "Collar layer printed on the front sheet",
            bbox: [732, 153, 1539, 327],
            path: "M726 420 L726 447 L858 474 L951 483 L1038 480 L1287 441 L1494 432 L1497 420 L1500 432 L1635 435 L1740 444 L1914 474 L1995 483 L2046 483 L2139 474 L2274 447 L2229 162 L2142 171 L2067 171 L1935 165 L1818 153 L1668 147 L1329 147 L1179 153 L1062 165 L939 171 L855 171 L768 162 Z",
          },
          {
            id: "front_a",
            title: "Front half, left on the sheet",
            bbox: [570, 543, 912, 1839],
            path: "M1218 537 L1206 537 L663 702 L681 915 L681 1035 L675 1104 L651 1221 L627 1287 L600 1332 L573 1350 L594 1623 L594 1674 L588 1692 L564 1710 L564 1755 L612 2385 L1485 2385 L1485 804 L1431 804 L1428 798 L1389 792 L1362 783 L1311 753 L1272 714 L1245 666 L1230 615 Z",
          },
          {
            id: "front_b",
            title: "Front half, right on the sheet",
            bbox: [1518, 543, 912, 1839],
            path: "M1779 537 L1761 639 L1752 666 L1725 714 L1686 753 L1635 783 L1596 795 L1569 798 L1566 804 L1512 804 L1512 2385 L2385 2385 L2433 1758 L2433 1710 L2409 1692 L2403 1674 L2403 1623 L2424 1350 L2397 1332 L2370 1287 L2343 1209 L2325 1125 L2316 1032 L2316 918 L2334 702 L1812 543 Z",
          },
          {
            id: "side_a",
            title: "Narrow piece, far left on the sheet (likely a side or under-arm piece)",
            bbox: [153, 1239, 378, 1143],
            path: "M330 1233 L303 1317 L285 1353 L258 1389 L231 1410 L210 1419 L147 1431 L147 1491 L195 2382 L438 2385 L534 2376 L474 1551 L471 1545 L435 1542 L420 1317 L342 1233 Z",
          },
          {
            id: "side_b",
            title: "Narrow piece, far right on the sheet",
            bbox: [2469, 1239, 378, 1143],
            path: "M2655 1233 L2577 1317 L2562 1542 L2526 1545 L2523 1551 L2463 2376 L2559 2385 L2802 2385 L2850 1491 L2850 1431 L2820 1428 L2772 1413 L2739 1389 L2712 1353 L2697 1323 L2667 1233 Z",
          },
          {
            id: "hem_front_a",
            title: "Front hem band, left on the sheet (folded)",
            bbox: [507, 2466, 975, 459],
            path: "M507 2466 L1482 2466 L1482 2925 L507 2925 Z",
          },
          {
            id: "hem_front_b",
            title: "Front hem band, right on the sheet (folded)",
            bbox: [1518, 2466, 975, 459],
            path: "M1518 2466 L2493 2466 L2493 2925 L1518 2925 Z",
          },
        ],
      },
      {
        placement: "pocket",
        printInches: [44, 46],
        printArea: { left: 122, top: 59, width: 2756, height: 2882 },
        templateImage:
          "https://files.cdn.printful.com/m/all_over_print_recycled_unisex_track_jacket/medium/templates/pocket_notext.png",
        pieces: [
          {
            id: "pocket_bag_1",
            title: "Pocket bag",
            bbox: [834, 351, 549, 858],
            path: "M1386 345 L1215 348 L1149 357 L1086 372 L1038 390 L990 417 L945 456 L912 501 L891 540 L867 603 L846 693 L837 756 L828 903 L834 1212 L1185 1185 L1386 1176 Z",
          },
          {
            id: "pocket_bag_2",
            title: "Pocket bag",
            bbox: [1617, 351, 486, 858],
            path: "M1611 345 L1611 1179 L2103 1212 L2106 867 L2100 780 L2088 690 L2070 612 L2055 567 L2025 504 L1998 465 L1956 423 L1887 384 L1830 366 L1683 345 Z",
          },
          {
            id: "pocket_bag_3",
            title: "Pocket bag",
            bbox: [894, 1791, 489, 858],
            path: "M1386 1785 L1305 1788 L1176 1806 L1107 1827 L1065 1848 L1032 1872 L1005 1899 L969 1950 L948 1992 L924 2061 L909 2127 L897 2211 L888 2382 L894 2652 L1386 2622 Z",
          },
          {
            id: "pocket_bag_4",
            title: "Pocket bag",
            bbox: [1617, 1791, 549, 858],
            path: "M1611 1785 L1611 2619 L1776 2625 L2118 2652 L2163 2652 L2169 2340 L2160 2199 L2148 2118 L2133 2055 L2109 1989 L2082 1938 L2055 1902 L2004 1857 L1947 1827 L1914 1815 L1791 1791 Z",
          },
        ],
      },
      {
        placement: "sleeve_left",
        printInches: [44, 46],
        printArea: { left: 122, top: 59, width: 2756, height: 2882 },
        templateImage:
          "https://files.cdn.printful.com/m/all_over_print_recycled_unisex_track_jacket/medium/templates/left_sleeve_notext.png",
        pieces: [
          {
            id: "sleeve_left",
            title: "Left sleeve",
            bbox: [684, 753, 1632, 1629],
            path: "M2319 1131 L2226 1101 L2139 1050 L2091 1011 L1953 879 L1896 837 L1830 801 L1764 777 L1686 759 L1539 747 L1425 750 L1344 759 L1260 777 L1182 804 L1104 846 L1059 879 L918 1011 L843 1068 L762 1107 L678 1128 L681 1149 L714 1230 L804 1485 L1101 2385 L1899 2385 L2190 1500 L2289 1221 L2319 1149 Z",
          },
          {
            id: "cuff_left",
            title: "Left cuff (folded band)",
            bbox: [1155, 2466, 690, 459],
            path: "M1155 2466 L1845 2466 L1845 2925 L1155 2925 Z",
          },
        ],
      },
      {
        placement: "sleeve_right",
        printInches: [44, 46],
        printArea: { left: 122, top: 59, width: 2756, height: 2882 },
        templateImage:
          "https://files.cdn.printful.com/m/all_over_print_recycled_unisex_track_jacket/medium/templates/right_sleeve_notext.png",
        pieces: [
          {
            id: "sleeve_right",
            title: "Right sleeve",
            bbox: [684, 753, 1632, 1629],
            path: "M678 1131 L684 1161 L726 1266 L807 1497 L1098 2385 L1896 2385 L2187 1515 L2187 1500 L2193 1497 L2265 1284 L2319 1146 L2319 1128 L2229 1104 L2151 1065 L2091 1020 L1944 882 L1890 843 L1830 810 L1740 777 L1689 765 L1572 750 L1455 747 L1356 753 L1296 762 L1224 780 L1176 798 L1122 825 L1068 861 L1002 918 L924 996 L855 1053 L759 1107 Z",
          },
          {
            id: "cuff_right",
            title: "Right cuff (folded band)",
            bbox: [1155, 2466, 690, 459],
            path: "M1155 2466 L1845 2466 L1845 2925 L1155 2925 Z",
          },
        ],
      },
    ],
    labels: [
      { placement: "label_inside", printInches: [2.5, 1] },
      { placement: "label_outside", printInches: [3, 3] },
    ],
  },
} as const satisfies Record<string, GarmentOutline>;
