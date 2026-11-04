// Creates a Client Panel user (and its practice if it doesn't exist yet).
//
//   npm run client:create-user -- --practice "Bright Smiles Dental" --name "Jane Whitfield" \
//       --email jane@brightsmiles.com --password "Secret@123" --role Owner --clinic cl1
//
// Roles: Owner | Manager | Front Desk | Billing | Dentist
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { ClientUser, CLIENT_ROLES } from "../../models/client/ClientUser.js";
import { Client as Tenant } from "../../models/Client.js";

dotenv.config();

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), all[i + 1]]);
    return acc;
  }, [])
);

const { practice, name, email, password, role = "Owner", clinic = "cl1" } = args;

const exit = async (code, message) => {
  console.log(message);
  await mongoose.disconnect();
  process.exit(code);
};

if (!practice || !name || !email || !password) {
  console.log('Required: --practice "<name>" --name "<name>" --email <email> --password <password>');
  process.exit(1);
}
if (!CLIENT_ROLES.includes(role)) {
  console.log(`Invalid role "${role}". Use one of: ${CLIENT_ROLES.join(", ")}`);
  process.exit(1);
}
if (password.length < 8) {
  console.log("Password must be at least 8 characters");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

if (await ClientUser.exists({ email: email.toLowerCase() })) {
  await exit(1, `A user with email ${email} already exists`);
}

// Reuse the practice if the Admin console (or an earlier run) already created it
const tenant = (await Tenant.findOne({ name: practice })) || (await Tenant.create({ name: practice }));

await ClientUser.create({
  tenantId: tenant._id,
  name,
  email,
  role,
  clinicId: clinic,
  password: await bcrypt.hash(password, 10),
});

await exit(0, `Created ${role} "${name}" <${email}> for practice "${tenant.name}" (clinic ${clinic})`);
