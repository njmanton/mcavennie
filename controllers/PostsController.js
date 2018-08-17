'use strict';

const models  = require('../models'),
      logger  = require('winston'),
      marked  = require('marked'),
      utils   = require('../utils'),
      emoji   = require('node-emoji'),
      moment  = require('moment');

const controller = {

  get_index: async (req, res) => {

    try {
      const posts = await models.Post.findAll({
        include: {
          model: models.User,
          attributes: ['username', 'id']
        },
        attributes: ['id', 'title', 'body', 'sticky', 'createdAt', 'updatedAt'],
        order: [['sticky', 'DESC'], ['updatedAt', 'DESC']]
      });
      posts.map(post => {
        post.body = emoji.emojify(marked(post.body));
        post.date = moment(post.createdAt).format('DD MMM, HH:mm');
        post.udate = (post.updatedAt && (post.updatedAt > post.createdAt)) ? moment(post.updatedAt).format('DD MMM, HH:mm') : null;
      });
      res.render('posts/index', {
        title: 'Posts',
        data: posts
      });
    } catch (e) {
      logger.error(`could not retrieve posts: ${ e.message }`);
      res.status(500).render('errors/500');
    }


  },

  get_id: async (req, res, id) => {
    const post = await models.Post.findById(id, {});
    res.render('posts/view', {
      post: post
    });
  },

  get_add: [utils.isAdmin, (req, res) => {
    res.render('posts/add', {
      title: 'Create New Post'
    });
  }],

  get_edit_id: [utils.isAdmin, async (req, res, id) => {

    try {
      const post = await models.Post.findById(id, { raw: true });
      if (!post) throw new Error('post not found');

      res.render('posts/add', {
        title: 'Edit Post',
        data: post,
        edit: true,
        debug: JSON.stringify(post, null, 2)
      });

    } catch (e) {
      req.flash('error', e.message);
      res.redirect('/posts');
    }

  }],

  post_preview: [utils.isAdmin, (req, res) => {
    res.send(emoji.emojify(marked(req.body.body)));
  }],

  post_edit: [utils.isAdmin, async (req, res) => {
    // handle req.body

    try {
      const usr = req.user ? req.user : { username: 'unknown' };
      let data = {
        title: req.body.title,
        body: req.body.body,
        sticky: req.body.sticky,
        author_id: usr.id || 0
      };
      const update = await models.Post.update(data, {
        where: { id: req.body.id }
      });
      if (!update) throw new Error('could not save update');

      logger.info(`Post ${ req.body.id } was successfully updated by ${ usr.username }`);
      req.flash('success', 'Post updated');
      res.redirect('/posts');

    } catch (e) {
      logger.error(e);
      req.flash('error', 'Sorry, there was an error updating that post');
      res.redirect('/posts');
    }

  }],

  post_add: [utils.isAdmin, async (req, res) => {
    const usr = req.user ? req.user.username : '(unknown)';
    const data = {
      title: req.body.title,
      body: req.body.body,
      sticky: req.body.sticky,
      author_id: usr.id || 0
    };

    try {
      const post = await models.Post.create(data);
      req.flash('success', `Post '${ post.title }' successfully added by ${ usr } `);
      res.redirect('/posts');
    } catch (e) {
      logger.error(e);
      req.flash('error', 'Sorry, there was a problem creating that post');
      res.redirect('/posts');
    }

  }],

  delete_id: [utils.isAdmin, async (req, res, id) => {
    let usr = req.user ? req.user.username : '(unknown)';

    try {
      const post = await models.Post.destroy({ where: { id: id } });

      logger.info(`Post ${ id } was deleted by ${ usr }`);
      res.status(200).send({ delete: true, count: post });
    } catch (e) {
      logger.error(e);
      res.status(500).send({ delete: false, msg: 'Could not delete post from database'});
    }
  }]
};

module.exports = controller;
