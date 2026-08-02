<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title inertia>{{ config('app.name', 'Seekoji - Service Management') }}</title>

    <!-- Favicon & Icons -->
    <link rel="icon" type="image/png" href="/images/favicon.png">
    <link rel="apple-touch-icon" href="/images/favicon.png">

    <!-- Google Fonts: Inter, Courier Prime & Material Symbols -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Courier+Prime:wght@400;700&display=swap"
        rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet">

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    @inertiaHead
</head>

<body class="font-sans antialiased bg-[#f9f9f7] text-[#1a1c1b] selection:bg-[#005ea4] selection:text-white min-h-full">
    @inertia
</body>

</html>