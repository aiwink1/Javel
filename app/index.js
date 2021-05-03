"use strict";

document.getElementById('app-version').innerText = APP.version;

const {
  BrowserQRCodeReader,
  BrowserQRCodeSvgWriter, 
  EncodeHintType
} = require('@zxing/library');
const QRCodeWriter = new BrowserQRCodeSvgWriter()
const QRCodeReader = new BrowserQRCodeReader()
const TOTP = require('./totp');
const Cookies = require('./cookies');
const OTPAuthUrl = require('./otpauthUrl');

let totpGenerator = undefined;

function copyToClipboard(value) {
    // Create a temporary input
    const input = document.createElement("input");
    // Append it to body
    document.body.appendChild(input);

    // Set input value
    input.setAttribute("value", value);
    // Select input value
    input.select();
    // Copy input value
    document.execCommand("copy");

    // Remove input from body
    document.body.removeChild(input);
}

function showToast(value, timeout) {
    timeout = timeout || 2000;

    const toastElement = document.createElement("div");
    toastElement.classList.add('toast');
    toastElement.innerText = value;

    document.body.appendChild(toastElement);
    setTimeout(function () {
        document.body.removeChild(toastElement);
    }, timeout);
}

function updateTotpGenerator() {
    let secret = document.getElementById('inputSecret').value.replace(/\s/g, '');
    let period = document.getElementById('inputPeriod').value;

    if (secret) {
        totpGenerator = new TOTP(secret, period);
    } else {
        totpGenerator = undefined;
    }

    refreshTotpToken();
}

function updateQrCode() {
    const secret = document.getElementById('inputSecret').value;
    const issuer = document.getElementById('inputIssuer').value;
    const account = document.getElementById('inputAccount').value;
    const period = document.getElementById('inputPeriod').value;

    let qrMessage = 'https://qoomon.me'
    document.getElementById('otpauth-qr-overlay').style.display = '';
    
    if (secret && account) {
        qrMessage = OTPAuthUrl.build(secret.replace(/\s+/g, ''), account, issuer, period);
        document.getElementById('otpauth-qr-overlay').style.display = 'none';
    }

    // generate qr code as svg data image url
    let svgElement = QRCodeWriter.write(qrMessage, 0, 0, new Map([
        [EncodeHintType.CHARACTER_SET, "UTF-8"],
        [EncodeHintType.ERROR_CORRECTION, "Q"],
        [EncodeHintType.MARGIN, 2],
      ])
    );
    
    var svgXml = new XMLSerializer().serializeToString(svgElement);
    var imageDataUrl = 'data:image/svg+xml;base64,' + btoa(svgXml);
    
    // set svg as image
    let img = document.getElementById('otpauth-qr-image');
    img.src = imageDataUrl;
    
    // convert svg image to png
    img.onload = () => {
      img.onload = null;
    
      var canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      canvas.getContext("2d")
        .drawImage(img, 0, 0, canvas.width, canvas.height);
    
      img.src = canvas.toDataURL();
    }
}

function updateLabel() {
    const issuer = document.getElementById('inputIssuer').value;
    const account = document.getElementById('inputAccount').value;
    let label = issuer;
    if (account) {
        if (label) {
          label += ` (${account})`
        } else {
          label += account
        }
    }

    document.getElementById('totp-label').innerText = label;
}

function showOtpAuthDetails() {
    document.getElementById('inputAccount').style.display = "";
    document.getElementById('inputIssuer').style.display = "";
    document.getElementById('inputPeriod').style.display = "";
    document.getElementById('otpauth-qr').style.display = "";
}

function hideOtpAuthDetails() {
    document.getElementById('inputAccount').style.display = "none";
    document.getElementById('inputIssuer').style.display = "none";
    document.getElementById('inputPeriod').style.display = "none";
    document.getElementById('otpauth-qr').style.display = "none";
}

function toggleOtpAuthDetails() {
    if (document.getElementById('inputAccount').style.display === 'none') {
        showOtpAuthDetails();
    } else {
        hideOtpAuthDetails();
    }
}

function toggleDarkMode() {
    const darkStyleElement = document.getElementById('dark-mode');
    darkStyleElement.disabled = !darkStyleElement.disabled;
    Cookies.set("otp-authenticator.darkStyle", !darkStyleElement.disabled);
}

function setRemainingTimePiePercentage(percentage) {
  document.querySelector("#totp-token-remaining-seconds-pie > circle").style.strokeDashoffset = -1 + percentage;
}

function formatToken(token) {
  return token.replace(/(...)(...)/g, '<span>$1</span><span style="margin-left:8px">$2</span>')
}

// ################  input handling  ##################

function handleOtpauthUrl(otpauthUrl) {
    // otpauth://totp/issuer%3Aaccount?secret=secret&issuer=issuer
    const otpauthParameters = OTPAuthUrl.parse(otpauthUrl);

    document.getElementById('inputSecret').value = otpauthParameters.secret || ' ';
    document.getElementById('inputSecret').dispatchEvent(new Event('input'));
    
    document.getElementById('inputIssuer').value = otpauthParameters.issuer || '';
    document.getElementById('inputIssuer').dispatchEvent(new Event('input'));
    
    document.getElementById('inputAccount').value = otpauthParameters.account || '';
    document.getElementById('inputAccount').dispatchEvent(new Event('input'));
    
    document.getElementById('inputPeriod').value = otpauthParameters.period || '';
    document.getElementById('inputPeriod').dispatchEvent(new Event('input'));
}

document.getElementById('inputVideoButton').addEventListener('click', () => {

  document.getElementById('inputVideoDialog').style.display = '';
  
  const decodeFromInputVideoDevice = (selectedDeviceId) => {
    QRCodeReader.decodeOnceFromVideoDevice(selectedDeviceId, 'inputVideo')
      .then((result) => {
        if(result.text.startsWith('otpauth://totp/')){
          handleOtpauthUrl(result.text)
        } else {
          alert('Invalid OTP auth QR code!')
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        QRCodeReader.reset()
        document.getElementById('inputVideoDialog').style.display = 'none'; 
      });
    };
  
  QRCodeReader.getVideoInputDevices()
    .then((videoInputDevices) => {
      if (videoInputDevices.length <= 0) {
        alert("No camera device available!")
        return;
      }
      if (videoInputDevices.length == 1) {
        decodeFromInputVideoDevice(videoInputDevices[0].deviceId);
      } else {
        let isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if(isMobileDevice) {
          decodeFromInputVideoDevice(undefined);
        } else {
          let videoInputDevice = videoInputDevices.find(device => device.label != 'Snap Camera');
          decodeFromInputVideoDevice(videoInputDevice.deviceId);
        }
      }
      
      // TODO
      // const sourceSelect = document.getElementById('sourceSelect')
      // sourceSelect.textContent = '';
      // 
      // videoInputDevices.forEach((element) => {
      //   const sourceOption = document.createElement('option')
      //   sourceOption.text = element.label
      //   sourceOption.value = element.deviceId
      //   sourceSelect.appendChild(sourceOption)
      // });
      // 
      // sourceSelect.onchange = () => {
      //   decodeFromInputVideoDevice(sourceSelect.value);
      // };
      
    })
    .catch((err) => console.error(err));
});

document.getElementById('inputVideoDialog').addEventListener('click', () => {
  QRCodeReader.reset();
  document.getElementById('inputVideoDialog').style.display = 'none'; 
});
 
document.getElementById('inputImage').addEventListener('change', (event) => {
  const imageFile = event.target.files[0];
  if(imageFile) {
    const image = new Image();
    var fileReader = new FileReader();
    fileReader.onload = (event) => image.src = event.target.result;
    fileReader.readAsDataURL(imageFile);
    image.onerror = (err) => alert('Invalid image!');
    image.onload = () => QRCodeReader.decodeFromImage(image)
      .then((result) => {
        if(result.text.startsWith('otpauth://totp/')) {
          handleOtpauthUrl(result.text);
        } else {
          alert('Invalid OTP auth QR code!')
        }
      })
      .catch((err) => {
        console.error(err);
        alert('Couldn\'t find any QR code in image!');
      });
  }
});

document.getElementById('inputSecret').addEventListener('input', (event) => {
    let secret = event.target.value;
    if (secret.startsWith("otpauth://totp/")) {
      handleOtpauthUrl(secret);
    }
    updateTotpGenerator();
    updateQrCode();
}, false);

document.getElementById('inputAccount').addEventListener('input', () => {
    updateLabel();
    updateQrCode();
}, false);

document.getElementById('inputIssuer').addEventListener('input', () => {
    updateLabel();
    updateQrCode();
}, false);

document.getElementById('inputPeriod').addEventListener('input', () => {
    updateTotpGenerator();
    updateQrCode();
}, false);

['click', 'tap'].forEach(event => {
    document.getElementById('totp-token').addEventListener(event, function () {
        copyToClipboard(this.innerText);
        showToast("Token copied!");
    }, false);
});

['click', 'tap'].forEach(event => {
    document.getElementById('otpauth-qr').addEventListener(event, function () {
        const secret = document.getElementById('inputSecret').value;
        const account = document.getElementById('inputAccount').value;
        const issuer = document.getElementById('inputIssuer').value;
        const period = document.getElementById('inputPeriod').value;
        const otpauthUrl = OTPAuthUrl.build(secret, account, issuer, period);
        copyToClipboard(otpauthUrl);
        showToast("OTPAuth url copied!");
    }, false);
});

['click', 'tap'].forEach(event => {
    document.getElementById('more-button').addEventListener(event, function () {
        toggleOtpAuthDetails();
    }, false);
});

['click', 'tap'].forEach(event => {
    document.getElementById('totp-label').addEventListener(event, function () {
        toggleOtpAuthDetails();
    }, false);
});

['click', 'tap'].forEach(event => {
    document.getElementById('light-switch').addEventListener(event, function () {
        toggleDarkMode();
    }, false);
});

// ################  run  ##################
if (!Cookies.get("otp-authenticator.darkStyle") && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    Cookies.set("otp-authenticator.darkStyle", "true");
}

if (Cookies.get("otp-authenticator.darkStyle") === "true") {
    toggleDarkMode();
}

updateQrCode();

setInterval(refreshTotpToken, 1000);
function refreshTotpToken() {
    let tokenElement = document.getElementById('totp-token');
    if (totpGenerator) {
        try {
            tokenElement.innerHTML = formatToken(totpGenerator.getToken());
            setRemainingTimePiePercentage(totpGenerator.getRemainingSeconds() / totpGenerator.getStepSeconds());
        } catch (err) {
            console.info(err.message);
            tokenElement.textContent = "Invalid Secret!";
            setRemainingTimePiePercentage(0);
        }
    } else {
        tokenElement.innerHTML = formatToken('000000');
        setRemainingTimePiePercentage(0);
    }
}
