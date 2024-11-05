const {
  Client,
  GatewayIntentBits,
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
  ],
});

// Keep track of active votes in each channel to avoid conflicts
const activeVotes = new Map();

client.once("ready", () => {
  console.log(`${client.user.tag} is online and ready!`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "vote") {
    const question = interaction.options.getString("question");
    const options = interaction.options.getString("options").split(",");

    if (options.length < 2) {
      return interaction.reply(
        "Please provide at least two options separated by commas."
      );
    }

    if (activeVotes.has(interaction.channelId)) {
      return interaction.reply(
        "A vote is already in progress in this channel. Please wait until it finishes."
      );
    }

    // Store active vote in channel to avoid conflicts
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

    setTimeout(() => {
      // Set up reaction collector
      const filter = (reaction, user) =>
        !user.bot && emojis.includes(reaction.emoji.name);
      const collector = message.createReactionCollector({
        filter,
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
        for (const vote of Object.values(votes)) {
          voteCounts[vote]++;
        }

        const maxVotes = Math.max(...voteCounts);
        const winningOptions = options.filter(
          (_, idx) => voteCounts[idx] === maxVotes
        );

        if (maxVotes === 0) {
          interaction.followUp("No votes were cast.");
        } else if (winningOptions.length > 1) {
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
    }, 1000);
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
});

client.login(process.env.TOKEN);
