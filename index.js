const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
require("dotenv").config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pxlok6c.mongodb.net/clean-co?retryWrites=true&w=majority&appName=Cluster0`;

// MongoDB Connection
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    //  create and connect collection-------------------
    const bookingCollection = client.db("clean-co").collection("bookings");
    const serviceCollection = client.db("clean-co").collection("services");

    // middleware ..... verify token--------------------
    const verifyToken = (req, res, next) => {
      const token = req.cookies?.token;
      console.log(token);
      if (!token) {
        return res
          .status(401)
          .send({ message: "Unauthorized: No token provided!" });
      }
      jwt.verify(token, process.env.SECRET_TOKEN, (error, decoded) => {
        if (error) {
          return res
            .status(401)
            .send({ message: "Unauthorized: Invalid token" });
        }
        req.user = decoded;
        next();
      });
    };

    app.post("/api/v1/auth/access-token", (req, res) => {
      // creating token and send to the client
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.SECRET_TOKEN, {
        expiresIn: "1h",
      });
      console.log(token);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    // get data by category or get data all---------
    // get data by sorting--------------------------
    app.get("/api/v1/services", verifyToken, async (req, res) => {
      let queryData = {};
      let sortInfo = {};
      const category = req.query?.category;
      const sortField = req.query.sortField;
      const sortOrder = req.query.sortOrder;
      if (category) {
        queryData.category = category;
      }

      if (sortField && sortOrder) {
        sortInfo[sortField] = sortOrder;
      }

      // pagination--------------------
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const skip = (page - 1) * limit;

      const cursor = serviceCollection
        .find(queryData)
        .skip(skip)
        .limit(limit)
        .sort(sortInfo);
      const result = await cursor.toArray();

      // count total data / documtents in the database
      const totalDocs = await serviceCollection.countDocuments();
      res.send({ totalDocs, result });
    });

    app.post("/api/v1/user/create-booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/api/v1/user/bookings", verifyToken, async (req, res) => {
      let query = {};
      const queryEmail = req.query.email;
      const tokenEmail = req.user.email;
      if (queryEmail !== tokenEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      if (queryEmail) {
        query.email = queryEmail;
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/api/v1/user/delete-booking/:bookingId", async (req, res) => {
      const id = req.params.bookingId;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    //   await client.close();
  }
}
run().catch(console.log);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
