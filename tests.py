import RPi.GPIO as GPIO
import subprocess
from __future__ import print_function

ledDfu = 7 # P7, G4 led1 (dfu)
ledFirmware = 11 # P11, G17 led2 (firmware)
ledJS = 13 # P13, G27 led3 (js)
ledPins = 15 # P15, G22 led4 (pins)
ledWifi = 16 # P16, G23 led5 (wifi)

ledDone = 19 # P19, G10 done led
ledError = 26 # P26 , G7 error LED

ledProg = 3 # P3, G2 programmable led
btnProg = 22 # P22, G25 program button

usbBoot = 12 #P12, G18
resetLine = 24 # P24 , G8 

wifiNetwork = ''
wifiPass = ''

def timeout( p ):
  if p.poll() == None:
    try:
      p.kill()
      print 'Error: process taking too long to complete--terminating'
    except:
      pass

def print_err(*objs):
  print("Error: ", *objs, end='\n', file=sys.stderr)

def wifiPing(ip, tries):
  # check wifi 
  for x in range(0, tries):
    # connect the device to wifi
    p = subprocess.Popen(['fping', '-c1', '-t500', ip], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    # listen for wifi success message
    if err:
      print_err(err, "error during ping check")
    elif "0%% loss" in out: # uh, hack
      return True
  return False

def wifiConnect(tries):
  for x in range(0, tries):
    # connect the device to wifi
    p = subprocess.Popen(['tessel', 'wifi', wifiNetwork, wifiPass], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    t = threading.Timer( 10.0, timeout, [p] )
    t.start()
    p.join()
    out, err = p.communicate()
    # listen for wifi success message
    if err:
      print_err(err, "error during wifi connect check")
    elif "Connected to WiFi!" in out: # uh, hack
      ipIndex = out.index("IP Address: ")
      dnsIndex = out.index("DNS: ")
      ip = out[ipIndex+12: dnsIndex-1]
      # ping it
      if wifiPing(ip, 3):
        GPIO.output(ledWifi, HIGH)
        return True
  return False

def jsLoad(codePath):
  # put on tesselatee code
  p = subprocess.Popen(['tessel', 'push', codePath], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
  t = threading.Timer( 10.0, timeout, [p] )
  t.start()
  p.join()
  # listen for tesselatee code bringup
  out, err = p.communicate()
  if err:
      print_err(err, "error during wifi connect check")
  elif "Passed Pin Test" in out and "Passed SCK test" in out and "Passed ADC test" in out and "Passed DAC test" in out: # uh, hack
    GPIO.output(ledPins, HIGH)
    return True
  
  return False

def runTests():
  return jsLoad('/bin/js/index.js') and wifiTest():

def resetTessel(dfuBoot):
  if dfuBoot:
    GPIO.setup(usbBoot, OUTPUT)
    GPIO.output(usbBoot, HIGH)

  GPIO.output(resetLine, LOW)
  # wait
  sleep(0.2);
  GPIO.output(resetLine, HIGH)

  GPIO.setup(usbBoot, IN)

def checkOTP(version):
  # reset device
  resetTessel(False)
  ## upgrade otp
  p = subprocess.Popen(['tessel', 'listen'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
  t = threading.Timer( 5.0, timeout, [p] )
  t.start()
  p.join()
  out, err = p.communicate()
  # print "out: ", out
  # print "err: ", err
  # if we're done go on
  if err:
    print_err(err, "error during otp check")
  elif "Board version: "+str(version) in out: # uh, hack
    return True
  progErr(True)
  return False

def checkFirmware():
  p = subprocess.Popen(['tessel', 'listen'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
  out, err = p.communicate()
  # print "out: ", out
  # print "err: ", err
  # if we're done go on
  if err:
    print_err(err, "error during firmware upgrade")
  elif "CC3000 firmware version: 1.24" in out: # uh, hack
    return True
  progErr(True)
  return False

def dfuRestore(tries, binaryPath):
  # lower pin
  resetTessel(True)

  for x in range(0, tries):
    # check for device in DFU mode
    p = subprocess.Popen(['tessel', 'dfu-restore', binaryPath], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = p.communicate()
    # print "out: ", out
    # print "err: ", err
    # if we're done go on
    if err:
      print_err(err, "try number", x)
    elif "Done!" in out and "100%" in out: # uh, hack
      return True

  progErr(True)
  return False
    
def buttonCheck():
  # check for programmable button press
  try:
    GPIO.wait_for_edge(btnProg, GPIO.RISING)
    # programmable led off
    GPIO.output(ledProg, GPIO.LOW)
    return True
  except KeyboardInterrupt:  
    GPIO.cleanup()
  # GPIO.cleanup() 
  return False

def progReady(ready):
  # programmable LED on
  GPIO.output(ledProg, GPIO.HIGH) if ready else GPIO.output(ledProg, GPIO.LOW)

def progErr(error):
  GPIO.output(ledError, GPIO.HIGH) if error else GPIO.output(ledError, GPIO.LOW)

def progDone(done):
  GPIO.output(ledDone, GPIO.HIGH) if done else GPIO.output(ledDone, GPIO.LOW)

def resetLEDs(ready, error, done):
  GPIO.output(ledDfu, LOW)
  GPIO.output(led, LOW)
  GPIO.output(ledDfu, LOW)
  GPIO.output(ledDfu, LOW)
  GPIO.output(ledDfu, LOW)

  progReady(ready)
  progErr(error)
  progDone(done)

def setup():
  # use P1 header pin numbering convention
  GPIO.setmode(GPIO.BOARD)

  # Set up the GPIO channels - one input and one output
  GPIO.setup(ledDfu, GPIO.OUT)
  GPIO.setup(ledFirmware, GPIO.OUT)
  GPIO.setup(ledJS, GPIO.OUT)
  GPIO.setup(ledPins, GPIO.OUT)
  GPIO.setup(ledWifi, GPIO.OUT)

  GPIO.setup(ledDone, GPIO.OUT)
  GPIO.setup(ledError, GPIO.OUT)

  GPIO.setup(ledProg, GPIO.OUT)
  GPIO.setup(btnProg, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

  GPIO.setup(resetLine, OUTPUT)
  GPIO.output(resetLine, GPIO.HIGH)

def bringup():
  resetLEDs(True, False, True)
  buttonCheck()
  # reset the device
  if dfuRestore(3, 'bin/1-23-tm02.bin'):
    GPIO.output(ledDfu, HIGH)
    # wait for firmware update
    firmwareRes = checkFirmware()
    # do an otp upgrade
    if dfuRestore(3, 'bin/otp-2.bin'):
      sleep(1)
      
      if (checkOTP(2) and firmwareRes)):
        GPIO.output(ledFirmware, HIGH)

        # put on non-firmware upgrade code
        if runTests() and dfuRestore(3, 'bin/1-23-tm02.bin'):
          # progDone(True)
          resetLEDs(True, False, True)
          return
  progErr(True)

setup()
while True:
  bringup()
