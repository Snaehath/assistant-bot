const {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
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
  partials: [
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
  ],
});

// ==============================
// Section 1: Welcome Message and Reaction Confirmation
// ==============================

const welcomeChannelId = "1303210264703008858"; // Replace with  welcome channel ID
const rulesChannelId = "1303204841304363078"; // Replace with  rules channel ID
const generalChannelId = "889143224768270339"; // Replace with  general channel ID

function getWelcomeMessage(member) {
  return {
    content: `Welcome to the server, ${member}! 🎉`,
    embeds: [
      new EmbedBuilder()
        .setTitle(`Welcome to ${member.guild.name}!`)
        .setDescription(
          `Hello ${member}, we're glad to have you here! Make sure to check out our rules in <#${rulesChannelId}> and introduce yourself in <#${generalChannelId}>.\n\n✅ **Please react below to confirm you've read the rules.**`
        )
        .setColor(0x3498db)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true })),
    ],
  };
}

client.on("guildMemberAdd", async (member) => {
  try {
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (!welcomeChannel) return console.error("Welcome channel not found!");

    const welcomeMessage = await welcomeChannel.send(getWelcomeMessage(member));
    await welcomeMessage.react("✅");

    const filter = (reaction, user) =>
      reaction.emoji.name === "✅" && user.id === member.id;
    const collector = welcomeMessage.createReactionCollector({
      filter,
      max: 1,
      time: 100000,
    });

    collector.on("collect", async () => {
      await member
        .send(
          "Thanks for confirming! Feel free to explore the server and reach out if you have questions."
        )
        .catch(console.error);
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        await member
          .send("Please confirm reading the rules to unlock the full server!")
          .catch(console.error);
      }
    });
  } catch (error) {
    console.error("Error sending welcome message:", error);
  }
});

// ==============================
// Section 2: Role Assignment via Reaction
// ==============================

const roleEmojiMap = {
  "🔴": "@active", // Replace with your role name or ID
  "🟢": "@leave me be",
  "🔵": "High Man",
};

client.on("messageCreate", async (message) => {
  if (
    message.content === "!assignroles" &&
    message.channel.id === welcomeChannelId
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
  if (reaction.message.channel.id !== welcomeChannelId || user.bot) return;
  const roleName = roleEmojiMap[reaction.emoji.name];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);
  const role = guild.roles.cache.find(
    (r) => r.name === roleName || r.id === roleName
  );
  if (!role)
    return reaction.message.channel.send(
      `⚠️ The role "${roleName}" does not exist.`
    );

  try {
    await member.roles.add(role);
    user.send(`✅ You have been assigned the "${roleName}" role!`);
    console.log(member);
  } catch (error) {
    console.error(error);
    user.send(
      "⚠️ I couldn't assign the role. Make sure I have the correct permissions."
    );
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  if (reaction.message.channel.id !== welcomeChannelId || user.bot) return;
  const roleName = roleEmojiMap[reaction.emoji.name];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);
  const role = guild.roles.cache.find(
    (r) => r.name === roleName || r.id === roleName
  );
  if (!role)
    return reaction.message.channel.send(
      `⚠️ The role "${roleName}" does not exist.`
    );

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

// ==============================
// Section 3: Voting System with Tie-Breaker
// ==============================

const activeVotes = new Map();

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "vote") {
    const question = interaction.options.getString("question");
    const options = interaction.options.getString("options").split(",");
    if (options.length < 2)
      return interaction.reply(
        "Please provide at least two options separated by commas."
      );

    if (activeVotes.has(interaction.channelId)) {
      return interaction.reply(
        "A vote is already in progress in this channel. Please wait until it finishes."
      );
    }

    activeVotes.set(interaction.channelId, { options, votes: {} });
    const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
    const optionList = options
      .map((option, index) => `${emojis[index]}: ${option}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`Vote: ${question}`)
      .setDescription(optionList)
      .setColor(0x3498db);

    const message = await interaction.reply({
      embeds: [embed],
      fetchReply: true,
    });
    for (let i = 0; i < options.length; i++) {
      await message.react(emojis[i]);
    }

    const collector = message.createReactionCollector({
      filter: (reaction, user) =>
        !user.bot && emojis.includes(reaction.emoji.name),
      time: 20000,
    });

    collector.on("collect", (reaction, user) => {
      const voteIndex = emojis.indexOf(reaction.emoji.name);
      activeVotes.get(interaction.channelId).votes[user.id] = voteIndex;
    });

    collector.on("end", async () => {
      const voteData = activeVotes.get(interaction.channelId);
      const { votes, options } = voteData;
      const voteCounts = Array(options.length).fill(0);
      for (const vote of Object.values(votes)) voteCounts[vote]++;

      const maxVotes = Math.max(...voteCounts);
      const winningOptions = options.filter(
        (_, idx) => voteCounts[idx] === maxVotes
      );
      activeVotes.delete(interaction.channelId);

      if (maxVotes === 0) return interaction.followUp("No votes were cast.");
      else if (winningOptions.length > 1) {
        activeVotes.delete(interaction.channelId);
        const tieEmbed = new EmbedBuilder()
          .setTitle(`Tie-breaking Vote: ${question}`)
          .setDescription(
            winningOptions
              .map((option, index) => `${emojis[index]}: ${option}`)
              .join("\n")
          )
          .setColor(0xe67e22);

        const tieMessage = await interaction.followUp({
          embeds: [tieEmbed],
          fetchReply: true,
        });

        for (let i = 0; i < winningOptions.length; i++) {
          await tieMessage.react(emojis[i]);
        }

        // Set up a new reaction collector for tie-breaking poll
        const tieFilter = (reaction, user) =>
          !user.bot && emojis.includes(reaction.emoji.name);
        const tieCollector = tieMessage.createReactionCollector({
          filter: tieFilter,
          time: 20000,
        });

        const tieVotes = {};
        tieCollector.on("collect", (reaction, user) => {
          const tieVoteIndex = emojis.indexOf(reaction.emoji.name);
          tieVotes[user.id] = tieVoteIndex;
        });

        tieCollector.on("end", () => {
          const tieVoteCounts = Array(winningOptions.length).fill(0);
          for (const tieVote of Object.values(tieVotes)) {
            tieVoteCounts[tieVote]++;
          }

          const tieMaxVotes = Math.max(...tieVoteCounts);
          const finalWinners = winningOptions.filter(
            (_, idx) => tieVoteCounts[idx] === tieMaxVotes
          );

          if (tieMaxVotes === 0) {
            interaction.followUp("No votes were cast in the tie-breaker.");
          } else if (finalWinners.length > 1) {
            interaction.followUp(
              `It's still a tie! Winning options: ${finalWinners.join(", ")}`
            );
          } else {
            interaction.followUp(
              `The winning option after tie-breaker is: ${finalWinners[0]}`
            );
          }

          activeVotes.delete(interaction.channelId);
        });
      } else {
        interaction.followUp(
          `The winning option is: ${winningOptions[0]} with vote count of ${maxVotes}`
        );
      }

      activeVotes.delete(interaction.channelId);
    });
  }
});

// Register the vote command with Discord
client.on("ready", async () => {
  const voteCommand = new SlashCommandBuilder()
    .setName("vote")
    .setDescription("Create a vote with a question and options")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("The question for voting")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("options")
        .setDescription("Comma-separated list of options")
        .setRequired(true)
    );

  await client.application.commands.create(voteCommand);
  console.log(`${client.user.tag} is online and ready!`);
});

// Log in to Discord
client.login(process.env.TOKEN);
