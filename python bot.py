import asyncio
import os
import discord
from discord import app_commands

TOKEN = os.environ["TOKEN"]

intents = discord.Intents.default()
intents.members = True


class MyBot(discord.Client):
    def __init__(self):
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        await self.tree.sync()


bot = MyBot()


@bot.tree.command(name="give-all", description="اعطاء الرتبة لكل اللي ما معهم أي رتبة")
@app_commands.describe(role_id="كود الرتبة (ID)")
@app_commands.checks.has_permissions(manage_roles=True)
@app_commands.guild_only()
async def give_all(interaction: discord.Interaction, role_id: str):
    if not role_id.isdigit():
        return await interaction.response.send_message("❌ كود الرتبة لازم يكون أرقام فقط.", ephemeral=True)

    guild = interaction.guild
    role = guild.get_role(int(role_id))

    if role is None:
        return await interaction.response.send_message("❌ ما لقيت رتبة بهذا الكود.", ephemeral=True)

    if role >= guild.me.top_role:
        return await interaction.response.send_message(
            "❌ رتبة البوت لازم تكون أعلى من الرتبة اللي تبي توزعها.", ephemeral=True
        )

    await interaction.response.defer(ephemeral=True, thinking=True)

    given = 0
    failed = 0

    async for member in guild.fetch_members(limit=None):
        if member.bot:
            continue
        if len(member.roles) > 1:
            continue
        try:
            await member.add_roles(role, reason=f"give-all بواسطة {interaction.user}")
            given += 1
            await asyncio.sleep(1)
        except (discord.Forbidden, discord.HTTPException):
            failed += 1

    await interaction.followup.send(
        f"✅ تم إعطاء {role.mention} لـ **{given}** عضو.\n❌ فشل: **{failed}**",
        ephemeral=True,
    )


@give_all.error
async def give_all_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    if isinstance(error, app_commands.MissingPermissions):
        await interaction.response.send_message("❌ تحتاج صلاحية إدارة الرتب.", ephemeral=True)
    else:
        raise error


@bot.event
async def on_ready():
    print(f"شغال باسم {bot.user}")


bot.run(TOKEN)
