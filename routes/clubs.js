const express = require('express');
const clubsRouter = express.Router();
const Club = require('../models/clubModel');
const User = require('../models/userModel');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const auth = require('./auth');
const postsRouter = require('./posts');

clubsRouter.use('/:clubId/posts', postsRouter);

// GENERAL
clubsRouter.get('/', async (req, res) => {
  try {
  const clubs = await Club.find();
  res.json(clubs)
  } catch (error) {
    res.json({ message: error });
  }
});

clubsRouter.get('/:id', async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      res.status(404).send('Cannot be found');
      return;
    }
    res.send(club);
  } catch (error) {
    res.json({ message: error });
  }
});

clubsRouter.get('/:id/members', async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      res.status(404).send('Cannot be found');
      return;
    }
    res.send(club.members);
  } catch (error) {
    res.json({ message: error });
  }
});
// ---------------
// CREATOR OF THE CLUB
clubsRouter.post('/', auth, async (req, res) => {
  try {
    const club = new Club({...req.body, createdBy: req.user._id});
    const savedClub = await club.save();

    let updateduser = await User.updateOne(
      { _id: club.createdBy},
      {$push: {'userClubs.createdClubs': club._id}}
    );
    res.send("A new club is created");
  } catch (error) {
    res.json({ message: error });
  }
});

clubsRouter.patch('/:id', auth, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      res.status(404).send('Cannot be found');
      return;
    }
    if (club.createdBy != req.user._id) {
      return res.send("you can't edit the club because it's not yours");
    }
    const updatedClub = await Club.updateOne(
      { _id: req.params.id },
      { $set: {...req.body}}
    );
    res.json(club);

  } catch (error) {
    res.json({ message: error });
  }
});
// ACCEPT A PENDING REQUEST OF A USER
clubsRouter.post('/:clubId/requests/accept/:userId', auth, async (req, res) => {
  try {
    const club = await Club.findById(req.params.clubId);
    if (!club) {
      res.status(404).send('Cannot be found');
      return;
    }
    if (!club.pendingRequests.includes(req.params.userId)) {
      res.status(404).send('Cannot be found');
      return;
    }
    if (club.createdBy != req.user._id)
    return res.send("Access Denied");

    club.pendingRequests.splice(req.params.userId, 1);
    club.members.push(req.params.userId);
    const savedClub = await club.save();

    const user = await User.findById(req.user._id)
    const acceptedUser = await User.findById(req.params.userId)
    const notif = {
      action: 'ClubMemberAccepted',
      links: [{content: user.username, id: req.user._id}, {content: club.title, id: club._id}],
      from: req.user._id,
      to: acceptedUser._id,
    }
    let updateduser = await User.updateOne(
      { _id: req.params.userId},
      {$push: {'userClubs.joinedClubs': club._id}, $pull: {'userClubs.pendingRequests': club._id}, $push: {'notifications': notif}}
    );
    // updateduser = await User.updateOne(
    //   { _id: req.params.userId},
    //   {$pull: {'userClubs.pendingRequests': club._id}}
    // );
    res.send("You accepted a new member at your club!");
  } catch (error) {
    console.log("in error");
    res.json({ message: "error" });
  }
});

// REFUSE A PENDING REQUEST OF A USER
clubsRouter.post('/:clubId/requests/refuse/:userId', auth, async (req, res) => {
  try {
    const club = await Club.findById(req.params.clubId);
    if (!club) {
      res.status(404).send('Cannot be found');
      return;
    }
    if (club.createdBy != req.user._id)
    return res.send("Access Denied");

    if (!club.pendingRequests.includes(req.params.userId)) {
      res.status(404).send('Cannot be found');
      return;
    }
    club.pendingRequests.splice(req.params.userId, 1)
    const savedClub = await club.save();
    updateduser = await User.updateOne(
      { _id: req.params.userId},
      {$pull: {'userClubs.pendingRequests': club._id}}
    );
    res.send("You refused a request to join your club!");
  } catch (error) {
    console.log("in error");
    res.json({ message: "error" });
  }
});

// DELETE A MEMBER FROM THE CLUB
clubsRouter.post('/:clubId/members/delete/:userId', auth, async (req, res) => {
  try {
    const club = await Club.findById(req.params.clubId);
    if (!club) {
      res.status(404).send('Cannot be found');
      return;
    }
    if (club.createdBy != req.user._id)
    return res.send("Access Denied");

    if (!club.members.includes(req.params.userId)) {
      res.status(404).send('Cannot be found');
      return;
    }
    club.members.splice(req.params.userId, 1)
    const savedClub = await club.save();
    updateduser = await User.updateOne(
      { _id: req.params.userId},
      {$pull: {'userClubs.joinedClubs': club._id}}
    );
    res.send("You deleted a member from your club!");
  } catch (error) {
    console.log("in error");
    res.json({ message: "error" });
  }
});

clubsRouter.delete('/:id', auth, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      res.status(404).send('Cannot be found');
      return;
    }
    if (club.createdBy != req.user._id) {
      return res.send("you can't remove the club because it's not yours");
    }
    let updatedCreator = await User.updateOne(
      { _id: req.user._id},
      {$pull: {'userClubs.createdClubs': club._id}}
    );
    for (let i = 0; i < club.members.length; i++) {
      let updatedMember = await User.updateOne(
        { _id: club.members[i]},
        {$pull: {'userClubs.joinedClubs': club._id}}
      );
    }
    for (let i = 0; i < club.pendingRequests.length; i++) {
      let updatedMember = await User.updateOne(
        { _id: club.members[i]},
        {$pull: {'userClubs.pendingRequests': club._id}}
      );
    }
    const removedClub = await Club.remove({ _id: req.params.id });
    res.json("Deleted");
  } catch (error) {
    res.json({ message: error });
  }
});
// ----------------
// MEMBER OF THE CLUB
// SEND A REQUEST TO JOIN A CLUB
clubsRouter.post('/:id/join', auth, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      res.status(404).send('Cannot be found');
      return;
    }
    if (club.createdBy == req.user._id)
    return res.send("you are already the owner of this club!");

    club.pendingRequests.push(req.user._id);
    const savedClub = await club.save();

    const owner = await User.findById(club.createdBy)
    const user = await User.findById(req.user._id)
    const notif = {
      action: 'ClubMemberAcceptedRequest',
      links: [{content: user.username, id: req.user._id}, {content: club.title, id: club._id}],
      from: req.user._id,
      to: club.createdBy,
    }
    let updateduser = await User.updateOne(
      { _id: club.createdBy},
      {$push: {'notifications': notif}}
    );
    updateduser = await User.updateOne(
      { _id: req.user._id},
      {$push: {'userClubs.pendingRequests': club._id}}
    );
    res.send("You sent a request to join the club!");
  } catch (error) {
    console.log("in error");
    res.json({ message: "error" });
  }
});

// CANCEL YOUR REQUEST
clubsRouter.post('/:id/cancel', auth, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      res.status(404).send('Cannot be found');
      return;
    }
    if (!club.pendingRequests.includes(req.user._id)) {
      res.status(404).send('Cannot be found');
      return;
    }

    club.pendingRequests.splice(req.user._id, 1);
    const savedClub = await club.save();
    let updateduser = await User.updateOne(
      { _id: req.user._id},
      {$pull: {'userClubs.pendingRequests': club._id}}
    );
    res.send("Cancelation is done");
  } catch (error) {
    console.log("in error");
    res.json({ message: "error" });
  }
});

// LEAVE THE CLUB
clubsRouter.post('/:id/leave', auth, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      res.status(404).send('Cannot be found');
      return;
    }
    if (!club.members.includes(req.user._id)) {
      res.status(404).send('Cannot be found');
      return;
    }

    club.members.splice(req.user._id, 1);
    const savedClub = await club.save();
    let updateduser = await User.updateOne(
      { _id: req.user._id},
      {$pull: {'userClubs.joinedClubs': club._id}}
    );
    res.send("You left the club!");
  } catch (error) {
    console.log("in error");
    res.json({ message: "error" });
  }
});
// ----------------
module.exports = clubsRouter;