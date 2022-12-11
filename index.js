const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = 5000;
var jwt = require('jsonwebtoken');
require('dotenv').config();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('hello');
})

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ljdbc6c.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send({ message: 'forbidden access' })
    }
    req.decoded = decoded;
    next();
  })

}

async function run() {
  try {
    const appointmentCategoriCollection = client.db("DoctorPortal").collection("appointmentCategori");
    const userAppointmentCollection = client.db("DoctorPortal").collection("userAppointment");
    const userCollection = client.db("DoctorPortal").collection("user");

    // jwt token
    // app.post('/jwt', (req, res) => {
    //   const user = req.body;
    //   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
    //   res.send({ token });
    // })

    // jwt token
    app.get('/jwt', async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: 'token does not exist' })
    })


    // get data for appointmentCategoriCollection
    app.get('/appointmentCategori', async (req, res) => {
      const date = req.query.date;

      const appointmentData = appointmentCategoriCollection.find({});
      const coursor = await appointmentData.toArray();

      const gettingBookingDate = { date: date };


      // get already booking data
      const alreadyBooked = await userAppointmentCollection.find(gettingBookingDate).toArray();

      coursor.forEach(option => {
        const optionBooked = alreadyBooked.filter(booked => booked.name === option.name);
        const bookedslots = optionBooked.map(book => book.slot)
        const remainingSlots = option.slots.filter(slot => !bookedslots.includes(slot));
        option.slots = remainingSlots;
      })

      res.send(coursor);
    })

    // send appointment data to server
    app.post('/appointmentcate', async (req, res) => {
      const appointment = req.body;
      const coursor = await userAppointmentCollection.insertOne(appointment)
      res.send(coursor);
    })

    // get user by email
    // verifyJWT
    app.get('/getuser', verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        res.status(403).send({ message: 'forbidden access' })
      }
      let query = { email: email };
      // if (req.query.email) {
      //   query = {
      //     email: req.query.email,
      //   }
      // }
      const cursor = userAppointmentCollection.find(query);
      const user = await cursor.toArray();
      res.send(user);

    })


    // send loged user to db
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // get all loged users
    app.get('/users', async (req, res) => {
      const user = await userCollection.find({}).toArray();
      res.send(user)
    })

    // make admin role
    app.put('/user/admin/:id', verifyJWT, async (req, res) => {

      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden acess' })
      }

      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          role: 'admin',
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc, option);
      res.send(result)
    })

    app.get('/user/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ isAdmin: user.role === 'admin' });
    })

  } finally {

  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`listening on ${port}`);
})