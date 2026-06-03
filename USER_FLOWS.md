# THEBOB E-Commerce User Journey Maps

## 👤 Customer User Flow

```
┌─────────────┐
│  Home Page  │
│     (/)     │
└──────┬──────┘
       │
       ├─────────────────────┬─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
   ┌────────┐          ┌──────────┐          ┌────────┐
   │ Login  │          │ Register │          │ Browse │
   │(/login)│          │(/register)          │Products│
   └───┬────┘          └────┬─────┘          │(/prod.)│
       │                    │                 └───┬────┘
       └────────┬───────────┘                     │
                │                                 │
                ▼                                 │
         ┌─────────────┐                         │
         │ Logged In   │                         │
         │             │                         │
         └─────┬───────┘                         │
               │                                 │
               └─────────────┬───────────────────┘
                             │
                    ┌────────▼────────┐
                    │ Product Detail  │
                    │ (/products/:id) │
                    └────────┬────────┘
                             │
                    ┌────────▼──────────┐
                    │ Add to Cart ✓     │
                    └────────┬──────────┘
                             │
                    ┌────────▼────────────┐
                    │ View Cart          │
                    │ (/cart)            │
                    └────────┬───────────┘
                             │
                    ┌────────▼──────────┐
                    │ Checkout          │
                    │ (/checkout)       │
                    └────────┬──────────┘
                             │
                    ┌────────▼──────────┐
                    │ Order Complete    │
                    │ (/orders/:id)     │
                    └────────┬──────────┘
                             │
                    ┌────────▼──────────┐
                    │ User Profile      │
                    │ (/user/profile)   │
                    │ View Orders       │
                    └───────────────────┘
```

## 👨‍💼 Admin User Flow

```
┌─────────────┐
│  Admin Home │
│   (/admin)  │
└──────┬──────┘
       │
       ├──────────────────┬──────────────────┬──────────────────┐
       │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼
  ┌─────────────┐  ┌────────────────┐  ┌──────────────┐  ┌────────────┐
  │ Product     │  │ Category       │  │ Order        │  │ Admin      │
  │ Management  │  │ Management     │  │ Management   │  │ Profile    │
  │/admin/prod. │  │/admin/categ.   │  │/admin/orders │  │/admin/prof │
  └──────┬──────┘  └────────┬───────┘  └──────┬───────┘  └────────────┘
         │                  │                  │
    ┌────┴───┐          ┌───┴────┐        ┌───┴───┐
    │         │          │        │        │       │
    ▼         ▼          ▼        ▼        ▼       ▼
 ┌─────┐  ┌─────┐   ┌─────┐  ┌──────┐ ┌────┐  ┌─────┐
 │List │  │Add  │   │Edit │  │Create│ │View│  │Edit │
 │     │  │     │   │     │  │      │ │    │  │     │
 │ ✓   │  │ ✓   │   │ ✓   │  │ ✓    │ │ ✓  │  │ ✓   │
 │     │  │     │   │     │  │      │ │    │  │     │
 └─────┘  └─────┘   └─────┘  └──────┘ │ +  │  └─────┘
    │         │        │         │    │    │
    │         │        │         │    │    │
    ▼         ▼        ▼         ▼    ▼    ▼
   View     Create   Update    Delete Manage Update
 Products   Product Product   Product Orders Status
   List                          List
```

## 🛒 Shopping Process Detailed

```
STEP 1: BROWSE
┌──────────────────────────────────┐
│ Home → Products                  │
│ Filter: Category, Price, Color   │
│ Sort: Newest, Price, Rating      │
└──────────────┬───────────────────┘

STEP 2: PRODUCT DETAIL
┌──────────────────────────────────┐
│ Click Product                    │
│ View Images, Details, Reviews    │
│ Select Size & Quantity           │
│ Check Stock & Pricing            │
└──────────────┬───────────────────┘

STEP 3: ADD TO CART
┌──────────────────────────────────┐
│ Click "Add to Cart"              │
│ Item Added Notification          │
│ Continue Shopping or View Cart   │
└──────────────┬───────────────────┘

STEP 4: REVIEW CART
┌──────────────────────────────────┐
│ View All Items                   │
│ Adjust Quantities                │
│ Remove Items                     │
│ Apply Coupon Code                │
│ View Shipping Cost               │
└──────────────┬───────────────────┘

STEP 5: CHECKOUT
┌──────────────────────────────────┐
│ Enter Shipping Address           │
│ Select Payment Method:           │
│  • COD (Cash on Delivery)        │
│  • Bank Transfer                 │
│  • Credit Card                   │
│ Review Order Summary             │
└──────────────┬───────────────────┘

STEP 6: ORDER CONFIRMATION
┌──────────────────────────────────┐
│ Order Placed Successfully        │
│ Order ID & Details               │
│ Estimated Delivery Date          │
│ Order Tracking Option            │
└──────────────────────────────────┘

STEP 7: ORDER TRACKING
┌──────────────────────────────────┐
│ User Profile → My Orders         │
│ View All Orders                  │
│ Track Order Status:              │
│  • Pending                       │
│  • Processing                    │
│  • Shipped                       │
│  • Delivered                     │
│ Leave Review (After Delivery)    │
└──────────────────────────────────┘
```

## 🔐 Authentication Flow

```
REGISTRATION
┌────────────┐      ┌──────────┐      ┌─────────┐
│   User     │─────→│ Backend  │─────→│Database │
│ Enters     │      │ Validates│      │ Stores  │
│ Details    │      │ & Hashes │      │ User    │
└────────────┘      └──────────┘      └─────────┘

LOGIN
┌────────────┐      ┌──────────┐      ┌─────────┐
│   User     │─────→│ Backend  │─────→│Database │
│ Email &    │      │ Verifies │      │ Checks  │
│ Password   │      │ Password │      │ User    │
└────────────┘      └──────────┘      └─────────┘
                           │
                    ┌──────▼──────┐
                    │ Generate    │
                    │ JWT Token   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────────┐
                    │ Send Token to   │
                    │ Frontend        │
                    └──────┬──────────┘
                           │
                    ┌──────▼──────────┐
                    │ Store in        │
                    │ localStorage    │
                    └─────────────────┘

AUTHENTICATED REQUESTS
┌──────────────┐      ┌───────────────┐
│ Frontend     │─────→│ API Request   │
│ Sends Token  │      │ Headers:      │
│ with Request │      │ Authorization │
│              │      │ Bearer {token}│
└──────────────┘      └───────┬───────┘
                              │
                       ┌──────▼──────┐
                       │ Backend     │
                       │ Validates   │
                       │ Token       │
                       └──────┬──────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                 Valid              Invalid
                    │                   │
                    ▼                   ▼
            ┌──────────────┐    ┌──────────────┐
            │ Process      │    │ Unauthorized │
            │ Request      │    │ (401) Error  │
            │ Return Data  │    │ Redirect to  │
            │ (200)        │    │ Login        │
            └──────────────┘    └──────────────┘
```

## 📊 Admin Dashboard Flow

```
                    ADMIN DASHBOARD
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    Statistics       Quick Links      Management
        │                │                │
    ├───┼───┐        ├────┼────┐      ├────┬────┤
    │   │   │        │    │    │      │    │    │
    ▼   ▼   ▼        ▼    ▼    ▼      ▼    ▼    ▼
   Prod Cat Ord    Prod  Cat  Ord   CRUD CRUD CRUD
   ucts egos rders ucts  egory rders
   
   View  View View
   Count Count Count

   └─►View Details ─►Edit ─►Save/Delete
      └─►Add New
      └─►Manage Images
      └─►Set Prices
      └─►Track Inventory
```

## 💳 Payment Options

```
PAYMENT METHODS AVAILABLE

1. COD (Cash on Delivery)
   └─► No payment upfront
   └─► Pay when delivered
   └─► Available for all orders

2. Bank Transfer
   └─► Manual transfer
   └─► Bank details provided
   └─► Confirmation required

3. Credit/Debit Card
   └─► Card details input
   └─► Processing (Demo only)
   └─► Instant confirmation

All methods include:
✓ Order confirmation email
✓ Tracking information
✓ Support contact
```

## 🔄 Order Status Workflow

```
                      Order Created
                            │
                            ▼
                      ┌─────────────┐
                      │   PENDING   │
                      │  Awaiting   │
                      │ Confirmation│
                      └──────┬──────┘
                             │ (Admin Confirms)
                             ▼
                      ┌─────────────┐
                      │ PROCESSING  │
                      │ Preparing   │
                      │ for Shipment│
                      └──────┬──────┘
                             │ (Packed & Ready)
                             ▼
                      ┌─────────────┐
                      │  SHIPPED    │
                      │  In Transit │
                      │  Tracking   │
                      └──────┬──────┘
                             │ (Delivered)
                             ▼
                      ┌─────────────┐
                      │ DELIVERED   │
                      │ Complete    │
                      │ Ready Review│
                      └─────────────┘

Alternative Path:
      │
      ▼
┌─────────────┐
│ CANCELLED   │
│ Order       │
│ Refunded    │
└─────────────┘
```

## 🗺️ Navigation Map

```
┌─────────────────────────────────────────┐
│            HEADER NAVIGATION             │
│  LOGO | SHOP | SEARCH | CART | ACCOUNT  │
└─────────────────────────────────────────┘
              │         │         │
              ▼         ▼         ▼
           HOME    PRODUCTS    LOGIN/
          (/)     (/products)  ACCOUNT
             │         │
             └────┬────┘
                  ▼
           PRODUCT DETAIL
           (/products/:id)
                  │
                  ▼
              CART
            (/cart)
                  │
                  ▼
            CHECKOUT
          (/checkout)
                  │
                  ▼
          ORDER DETAIL
         (/orders/:id)
                  │
                  ▼
            PROFILE
        (/user/profile)
        
ADMIN ONLY:
            ADMIN PANEL
            (/admin)
                  │
        ┌─────┬──┴──┬──────┐
        ▼     ▼     ▼      ▼
     Products Categories Orders Profile
```

---

These user flow diagrams help understand:
- Customer journey from browsing to order completion
- Admin workflow for managing products and orders
- Authentication and security flow
- Payment options and order status progression
- Complete site navigation structure
