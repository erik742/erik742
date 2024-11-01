<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BandzEB Shop</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
        }
        header, footer {
            background-color: #333;
            color: #fff;
            text-align: center;
            padding: 1em 0;
        }
        nav {
            display: flex;
            justify-content: center;
            gap: 15px;
            background-color: #444;
            padding: 1em 0;
        }
        nav a {
            color: #fff;
            text-decoration: none;
        }
        .product {
            border: 1px solid #ccc;
            padding: 15px;
            margin: 15px;
            text-align: center;
        }
        .product img {
            max-width: 100%;
            height: auto;
        }
        .product h2 {
            font-size: 1.5em;
        }
        .products {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
        }
        footer p {
            margin: 0;
        }
    </style>
</head>
<body>

    <!-- Header -->
    <header>
        <h1>Welcome to BandzEB Shop</h1>
        <p>Your go-to store for trendy accessories!</p>
    </header>

    <!-- Navigation -->
    <nav>
        <a href="#home">Home</a>
        <a href="#products">Products</a>
        <a href="#about">About Us</a>
        <a href="#contact">Contact</a>
    </nav>

    <!-- Product Section -->
    <section id="products">
        <h2>Our Products</h2>
        <div class="products">
            <div class="product">
                <img src="bracelet1.jpg" alt="Stylish Bracelet">
                <h2>Stylish Bracelet</h2>
                <p>$15.00</p>
                <button>Add to Cart</button>
            </div>
            <div class="product">
                <img src="ring1.jpg" alt="Elegant Ring">
                <h2>Elegant Ring</h2>
                <p>$20.00</p>
                <button>Add to Cart</button>
            </div>
            <div class="product">
                <img src="necklace1.jpg" alt="Chic Necklace">
                <h2>Chic Necklace</h2>
                <p>$25.00</p>
                <button>Add to Cart</button>
            </div>
        </div>
    </section>

    <!-- About Section -->
    <section id="about">
        <h2>About Us</h2>
        <p>BandzEB Shop offers a curated collection of fashionable and high-quality accessories, designed to enhance your style. We are passionate about providing the latest trends and timeless pieces.</p>
    </section>

    <!-- Contact Section -->
    <section id="contact">
        <h2>Contact Us</h2>
        <p>Email: support@bandzebshop.com</p>
        <p>Phone: +1 (234) 567-890</p>
    </section>

    <!-- Footer -->
    <footer>
        <p>&copy; 2024 BandzEB Shop - All rights reserved.</p>
    </footer>

</body>
</html>
