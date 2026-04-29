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
        AxioMarket
      </h1>

      <p>Dear Ambassador,</p>

      <p>
        Welcome, and congratulations on becoming an official ambassador. 
        We’re excited to have you on board and look forward to building with you.
      </p>

      <p>
        Our testnet has been live since April 25, 2026, and you can access it here:<br/>
        <a href="https://axiomarket.xyz/login/" style="color:#999999;">
          https://axiomarket.xyz/login/
        </a>
      </p>

      <p>
        The platform is currently stable. However, due to earlier bugs and system 
        restrictions, we were unable to send out communications, and the platform 
        could not run continuously for 24 hours at a time.
      </p>

      <p>
        We sincerely apologize for any inconvenience this may have caused.
      </p>

      <p>
        Our team is actively working on improvements, and a full system upgrade will 
        be completed within the next 14 days. In the meantime, you can continue using 
        the platform, although uptime may still be limited.
      </p>

      <p>
        For faster updates, discussions, and direct communication, please join the ambassador group chat:<br/>
        <a href="https://chat.whatsapp.com/CVlWYYLgifs5cX9icdvxg1" style="color:#999999;">
          Join WhatsApp Group
        </a>
      </p>

      <p>Thank you for your patience and support.</p>

      <p style="margin-top:30px;">
        Warm regards,<br/>
        Axio Team
      </p>

      <div style="text-align:center;margin-top:40px;">
        <img src="cid:logo" alt="AxioMarket Logo" style="width:30px;height:auto;" />
      </div>

    </div>
  </div>
  `;
};


module.exports = { getAmbassadorEmailTemplate };