const getAmbassadorEmailTemplate = () => {
  return `
  <div style="
    background-color:#000000;
    color:#ffffff;
    font-family: Arial, sans-serif;
    padding:40px 20px;
  ">
    <div style="max-width:600px;margin:0 auto;">
      
      <div style="text-align:center;margin-bottom:20px;">
        <img src="cid:logo" alt="AxioMarket Logo" style="width:40px;height:auto;" />
      </div>

      <h1 style="color:#ff3b3b;font-size:28px;margin-bottom:20px;">
        Welcome to the AxioMarket Ambassador Program 🚀
      </h1>

      <p>Dear Ambassador,</p>

      <p>
        Congratulations and thank you for moving forward to the next stage of the AxioMarket Ambassador Program.
      </p>

      <p>
        We truly appreciate your commitment and consistency in being part of this journey. 
        You are now officially part of a more active core group helping shape the future of AxioMarket.
      </p>

      <p>
        AxioMarket is now LIVE on MAINNET and fully operational.
      </p>

      <p>
        Access the platform here:<br/>
        <a href="https://axiomarket.xyz/login/" style="color:#999999;">
          https://axiomarket.xyz/login/
        </a>
      </p>

      <p>
        As an ambassador at this stage, your role becomes even more important — sharing, onboarding users, and strengthening the ecosystem.
      </p>

      <p>
        To stay connected with the team and other selected ambassadors, please join the official WhatsApp group:<br/>
        <a href="https://chat.whatsapp.com/JJ8DGvc0gUb3Mad2RmukH0?mode=gi_t" style="color:#999999;">
          Join WhatsApp Ambassador Group
        </a>
      </p>

      <p>
        We are building something big — and we’re glad you’re here early.
      </p>

      <p style="margin-top:30px;">
        Warm regards,<br/>
        AxioMarket Team
      </p>

      <div style="text-align:center;margin-top:40px;">
        <img src="cid:logo" alt="AxioMarket Logo" style="width:30px;height:auto;" />
      </div>

    </div>
  </div>
  `;
};

module.exports = { getAmbassadorEmailTemplate };