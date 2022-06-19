const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();
const Stripe = require("stripe");
const stripe = Stripe(
  "sk_test_51L3OIOBhVNHGopJmVqOY4zhkk5u8fzTvP4jaSzlKt6sU7bmuEs954fRzF12OdspX0wl4JaEvXYpcOHAZP2BwaUD300jN2k85jT"
);

//middleware
app.use(cors());
app.use(express.json());
//  verify jwt

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log(authHeader);
  if (!authHeader) {
    console.log("acces");
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader;
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}
// database connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yit7l.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// datebase integration

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("gunParts").collection("services");
    const userCollection = client.db("gunParts").collection("users");
    const orderCollection = client.db("gunParts").collection("orders");
    const reviewCollection = client.db("gunParts").collection("reviews");

    // Token generate
    app.post("/gettoken", (req, res) => {
      // let jwtoken = crypto.randomBytes(64).toString('hex')
      const user = req.body;
      const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "30d",
      });
      res.send({ accessToken });
    });

    // paymet

    app.post("/create-payment-intent", async (req, res) => {
      const { total } = req.body;
      const amount = parseInt(total * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // users
    app.get("/user/:email", async (req, res) => {
      console.log("user get");
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user) {
        res.send({ status: "success", data: user });
      } else {
        res.send({ status: 404 });
      }
    });

    app.get("/user", verifyJWT, async (req, res) => {
      const user = await userCollection.find();

      console.log("users get");
      const result = await user.toArray();
      if (result) {
        res.send({ status: "success", data: result });
      } else {
        res.send({ status: 404 });
      }
    });

    app.put("/user", async (req, res) => {
      const newUser = req.body;

      console.log("user put");
      const query = { email: newUser.email };
      const user = await userCollection.updateOne(
        query,
        { $set: newUser }, // Update
        { upsert: true } // add document with req.body._id if not exists
      );
      if (user.acknowledged) {
        res.send({ status: "success" });
      } else {
        res.send({ status: "404" });
      }
    });

    // orders

    app.put("/order", verifyJWT, async (req, res) => {
      const { _id, ...updateOrder } = req.body;

      console.log("order put");
      const query = { _id: ObjectId(_id) };
      const updated = await orderCollection.updateOne(
        query,
        { $set: updateOrder }, // Update
        { upsert: true } // add document with req.body._id if not exists
      );
      const cursor = await orderCollection.findOne(query);
      res.send({ status: "success", data: cursor });
    });

    app.post("/order", verifyJWT, async (req, res) => {
      const product = req.body;

      console.log("order post");
      const order = await orderCollection.insertOne(product);
      if (order.acknowledged) {
        const result = await orderCollection.findOne({
          _id: order.insertedId,
        });

        res.send({ result, status: "success" });
      } else {
        res.send("404 error");
      }
    });

    app.get("/orders", verifyJWT, async (req, res) => {
      console.log("order get");
      const email = req.query.email;
      const status = req.query.status;
      let query = {};
      if (email) {
        if (status === "all") {
          query = { email: email };
        } else {
          query = { email: email, status: status };
        }
      }
      // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
      const cursor = await orderCollection.find(query);
      const userProduct = await cursor.toArray();
      res.send(userProduct);
    });

    app.get("/order/:id", async (req, res) => {
      const id = req.params.id;

      console.log("order id get");
      const query = { _id: ObjectId(id) };
      const cursor = await orderCollection.findOne(query);
      res.send(cursor);
    });


    app.delete("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const cursor = await orderCollection.deleteOne(query);
      res.send(cursor);
    });

    // reviews

    app.post("/review/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;

      console.log("review post");
      const query = { _id: ObjectId(id) };
      const deleteProduct = await reviewCollection.deleteOne(query);
      if (deleteProduct.acknowledged) {
        res.send({ status: "success" });
      }
    });

    app.post("/review", verifyJWT, async (req, res) => {
      const postReview = req.body;

      console.log("review post]");
      const review = await reviewCollection.insertOne(postReview);
      if (review.acknowledged) {
        const result = await reviewCollection.findOne({
          _id: review.insertedId,
        });

        res.send({ result, status: "success" });
      } else {
        res.send("404 error");
      }
    });

    app.get("/reviews", async (req, res) => {
      const product = req.query.product;

      console.log("reviews get");
      const email = req.query.email;
      let query = {};
      if (product) {
        query = { "product._id": product };
      }
      if (email) {
        query = { "profile.email": email };
      }

      // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
      const cursor = await reviewCollection.find(query).sort({ _id: -1 });
      const userProduct = await cursor.toArray();
      res.send(userProduct);
    });

    // products complete

    app.put("/product", verifyJWT, async (req, res) => {
      const { _id, ...updateProduct } = req.body;

      console.log("product put");
      const query = { _id: ObjectId(_id) };
      const updated = await serviceCollection.updateOne(
        query,
        { $set: updateProduct }, // Update
        { upsert: true } // add document with req.body._id if not exists
      );
      const cursor = await serviceCollection.findOne(query);
      res.send({ status: "success", data: cursor });
    });

    // delete
    app.post("/product/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;

      console.log("product post");
      const query = { _id: ObjectId(id) };
      const deleteProduct = await serviceCollection.deleteOne(query);
      if (deleteProduct.acknowledged) {
        res.send({ status: "success" });
      }
    });

    app.get("/products", async (req, res) => {
      const parts = req.query.parts;

      console.log("products get");
      let query = {};
      if (parts) {
        query = { partsType: parts };
      }

      const cursor = await serviceCollection.find(query).sort({ _id: -1 });
      const userProduct = await cursor.toArray();
      res.send(userProduct);
    });

    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      console.log("produc get");
      const query = { _id: ObjectId(id) };
      const cursor = await serviceCollection.findOne(query);
      res.send(cursor);
    });
  } finally {
    // client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Running server");
});

app.listen(port, () => {
  console.log("lisening form ", port);
});
