'use strict';

const Post = (sequelize, DataTypes) => {

  const model = sequelize.define('posts', {
    id: {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    body: {
      type: DataTypes.STRING,
      allowNull: true
    },
    author_id: {
      type: DataTypes.INTEGER(10),
      allowNull: true
    },
    sticky: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
      defaultValue: 0
    }
  });

  return model;

};

module.exports = Post;
