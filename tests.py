# test runner for Testalator
import Adafruit_BBIO.GPIO as GPIO
import Adafruit_BBIO.PWM as PWM
import Adafruit_BBIO.ADC as ADC
import Adafruit_BBIO.UART as UART
import Adafruit_BBIO.SPI as SPI
from Adafruit_I2C import Adafruit_I2C # ugh why

tessel = {
  "A": {"G1": "GPIO2_15", "G2": "GPIO2_14", "G3": "GPIO1_6"}
}

def gpioTest(state):
  ## port A

  # gpio2[15]
  # GPIO.setup("GPIO2_15", GPIO.OUT)
  # GPIO.output("GPIO2_15", GPIO.HIGH)

  # # gpio2[14]
  # GPIO.setup("GPIO2_14", GPIO.OUT)
  # GPIO.output("GPIO2_14", GPIO.HIGH)
  # GPIO1_6 
  # ## port B
  # gpio0[9] 
  # gpio0[8] 
  # GPIO1_2
  # ## port C
  # gpio0[2] 
  # gpio0[3] 
  # GPIO1_7
  # ## port D
  # gpio0[30] 
  # gpio0[31] 
  # GPIO1_3
  # ## gpio port
  # GPIO2_24
  # GPIO2_25
  # GPIO0_11
  # GPIO2_13
  # GPIO2_9
  for pin in tessel["A"]:
    print "setting up", pin
    GPIO.setup(tessel["A"][pin], GPIO.OUT)
    GPIO.output(tessel["A"][pin], GPIO.HIGH)
    
  GPIO.cleanup()
  return