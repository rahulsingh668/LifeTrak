<?php
return [
    [
        'slug' => 'pregnancy', 'name' => 'Pregnancy journey', 'emoji' => '🤰',
        'currency' => '₹', 'budget' => 250000,
        'phases' => ['Trimester 1', 'Trimester 2', 'Trimester 3', 'Post-natal'],
        'categories' => [
            ['id'=>'doctor',    'name'=>'Doctor visits',       'emoji'=>'🩺', 'budget'=>30000],
            ['id'=>'medicines', 'name'=>'Medicines',            'emoji'=>'💊', 'budget'=>15000],
            ['id'=>'scans',     'name'=>'Scans & tests',        'emoji'=>'🔬', 'budget'=>25000],
            ['id'=>'hospital',  'name'=>'Hospital & delivery',  'emoji'=>'🏥', 'budget'=>100000],
            ['id'=>'baby',      'name'=>'Baby gear',            'emoji'=>'👶', 'budget'=>30000],
            ['id'=>'nutrition', 'name'=>'Nutrition',            'emoji'=>'🥗', 'budget'=>20000],
            ['id'=>'postnatal', 'name'=>'Post-natal care',      'emoji'=>'🌸', 'budget'=>20000],
            ['id'=>'misc',      'name'=>'Miscellaneous',        'emoji'=>'📦', 'budget'=>10000],
        ],
    ],
    [
        'slug' => 'vacation', 'name' => 'Vacation', 'emoji' => '✈️',
        'currency' => '₹', 'budget' => 150000,
        'phases' => ['Pre-trip', 'During', 'Return'],
        'categories' => [
            ['id'=>'flights',    'name'=>'Flights',    'emoji'=>'✈️', 'budget'=>50000],
            ['id'=>'hotels',     'name'=>'Hotels',     'emoji'=>'🏨', 'budget'=>40000],
            ['id'=>'food',       'name'=>'Food',       'emoji'=>'🍜', 'budget'=>20000],
            ['id'=>'activities', 'name'=>'Activities', 'emoji'=>'🎯', 'budget'=>20000],
            ['id'=>'shopping',   'name'=>'Shopping',   'emoji'=>'🛍️', 'budget'=>15000],
            ['id'=>'transport',  'name'=>'Transport',  'emoji'=>'🚕', 'budget'=>5000],
        ],
    ],
    [
        'slug' => 'wedding', 'name' => 'Wedding', 'emoji' => '💍',
        'currency' => '₹', 'budget' => 1500000,
        'phases' => ['Pre-wedding', 'Wedding day', 'Post-wedding'],
        'categories' => [
            ['id'=>'venue',    'name'=>'Venue & decor',      'emoji'=>'🌺', 'budget'=>400000],
            ['id'=>'catering', 'name'=>'Catering',           'emoji'=>'🍽️', 'budget'=>350000],
            ['id'=>'attire',   'name'=>'Attire & jewellery', 'emoji'=>'👗', 'budget'=>200000],
            ['id'=>'photo',    'name'=>'Photography',        'emoji'=>'📸', 'budget'=>150000],
            ['id'=>'music',    'name'=>'Music',              'emoji'=>'🎶', 'budget'=>100000],
            ['id'=>'misc',     'name'=>'Misc',               'emoji'=>'📦', 'budget'=>300000],
        ],
    ],
];
