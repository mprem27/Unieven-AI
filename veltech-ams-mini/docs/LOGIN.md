# One sign-in page

The phone-style logo → student profile → syncing welcome is described in [Login welcome screen](LOGIN-WELCOME.md). It uses authenticated records and does not add source requests or change account/session permissions.

Open `/#/login`. Enter **Username or email** and **Password**. There are no Student, Faculty or Admin tabs; old role-specific links redirect here.

| Account | What to enter | Workspace |
| --- | --- | --- |
| Student | Your own AMS VTU username or `vtu...@veltech.edu.in` mailbox and AMS password | Home |
| Faculty | Your provisioned username/email and application password | Forms |
| Owner administrator | Your provisioned username/email and application password | Management |
| Limited administrator | Your provisioned username/email and application password | First assigned management, academic, calendar, examination or form area |

The server checks the saved account and credentials before choosing a role. An email prefix never grants staff access. Known staff passwords are never forwarded to AMS. Students complete the university's verification only when AMS requires it; it remains tied to the requesting browser. New upstream verification does not create a campus session until it succeeds.

Setup provisions the first owner administrator. Owners create faculty and explicitly limited administrators in **Management → Roles & accounts → Create account**. There is no public staff/admin registration or shared default production password. [Administrator permissions](ADMIN-ACCESS.md).

Forgot password uses your configured SMTP/Brevo provider and verified recovery address/college VTU mailbox. It changes the application password, not your university password. A provisioned/recovered application account can sign in using its provisioned/verified recovery email and application password. Valid campus sessions restore after refresh or a PWA shell update. Genuine AMS source-session expiry remains separate.
