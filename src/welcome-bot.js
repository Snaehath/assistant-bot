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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.GuildMember, Partials.Message, Partials.Reaction],
});

const welcomeChannelId = "1303210264703008858";

client.once("ready", () => {
  console.log(`${client.user.tag} is online and ready!`);
});

function getWelcomeMessage(member) {
  return {
    content: `Welcome to the server, ${member}! 🎉`,
    embeds: [
      new EmbedBuilder()
        .setTitle(`Welcome to ${member.guild.name}!`)
        .setDescription(
          `Hello ${member}, we're glad to have you here! Make sure to check out our rules in <#RULES_CHANNEL> and introduce yourself in <#GENERAL_CHANNEL>.\n\n✅ **Please react below to confirm you've read the rules.**`
        )
        .setColor(0x3498db)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true })),
    ],
  };
}

// Event handler for when a new member joins the server
client.on("guildMemberAdd", async (member) => {
  try {
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);

    if (!welcomeChannel) {
      console.error("Welcome channel not found!");
      return;
    }

    // Send the welcome message
    const welcomeMessage = await welcomeChannel.send(getWelcomeMessage(member));

    // React with an emoji to allow users to confirm they've read the rules
    await welcomeMessage.react("✅");

    const filter = (reaction, user) => {
      return reaction.emoji.name === "✅" && user.id === member.id;
    };

    const collector = welcomeMessage.createReactionCollector({
      filter,
      max: 1,
      time: 100000,
    });

    collector.on("collect", async () => {
      try {
        await member.send(
          "Thanks for confirming! Feel free to explore the server and reach out if you have questions."
        );
      } catch (error) {
        console.error("Could not send DM to member:", error);
      } finally {
        collector.stop();
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        try {
          await member.send(
            "It looks like you didn't confirm reading the rules. Please do so to unlock the full server!"
          );
        } catch (error) {
          console.error("Could not send DM to member:", error);
        }
      }
    });
  } catch (error) {
    console.error("Error sending welcome message:", error);
  }
});

// Log in to Discord
client.login(process.env.TOKEN);
