const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
} = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

// Define roles
const roleEmojiMap = {
  "🔴": "@active", // Replace with your role name or ID
  "🟢": "@leave me be",
  "🔵": "High Man",
};

const allowedChannelId = "889143224768270339";

client.once("ready", () => {
  console.log(`${client.user.tag} is online and ready!`);
});

client.on("messageCreate", async (message) => {
  if (
    message.content === "!assignroles" &&
    message.channel.id === allowedChannelId
  ) {
    const embed = new EmbedBuilder()
      .setTitle("React to assign yourself a role")
      .setDescription(
        Object.entries(roleEmojiMap)
          .map(([emoji, role]) => `${emoji}: ${role}`)
          .join("\n")
      )
      .setColor(0x3498db);

    const roleMessage = await message.channel.send({ embeds: [embed] });
    for (const emoji of Object.keys(roleEmojiMap)) {
      await roleMessage.react(emoji);
    }
  }
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (reaction.message.channel.id !== allowedChannelId || user.bot) return;

  const roleName = roleEmojiMap[reaction.emoji.name];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);

  const role = guild.roles.cache.find(
    (r) => r.name === roleName || r.id === roleName
  );
  if (!role) {
    reaction.message.channel.send(`⚠️ The role "${roleName}" does not exist.`);
    return;
  }

  try {
    await member.roles.add(role);
    user.send(`✅ You have been assigned the "${roleName}" role!`);
  } catch (error) {
    console.error(error);
    user.send(
      "⚠️ I couldn't assign the role. Make sure I have the correct permissions."
    );
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  if (reaction.message.channel.id !== allowedChannelId || user.bot) return;

  const roleName = roleEmojiMap[reaction.emoji.name];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);

  const role = guild.roles.cache.find(
    (r) => r.name === roleName || r.id === roleName
  );
  if (!role) {
    reaction.message.channel.send(`⚠️ The role "${roleName}" does not exist.`);
    return;
  }

  try {
    await member.roles.remove(role);
    user.send(`❌ The "${roleName}" role has been removed from you.`);
  } catch (error) {
    console.error(error);
    user.send(
      "⚠️ I couldn't remove the role. Make sure I have the correct permissions."
    );
  }
});

client.login(process.env.TOKEN);
