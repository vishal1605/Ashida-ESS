import frappe
from frappe import _


@frappe.whitelist(allow_guest=True)
def mobile_app_login(usr, app_password, device_id, device_model, device_brand):
	"""
	Authenticate user for mobile app with app_id and app password

	Args:
		usr: App ID (unique identifier set in Employee record)
		app_password: App password set in Employee record
		device_id: Unique device identifier from mobile app
		device_model: Device model name (e.g., "iPhone 14 Pro", "Galaxy S21")
		device_brand: Device brand/manufacturer (e.g., "Apple", "Samsung")

	Returns:
		dict: Authentication result with user details or error message
	"""
	try:
		# Sanitize input - remove leading/trailing whitespace
		usr = usr.strip() if usr else ""

		if not usr:
			return {
				"success": False,
				"message": _("App ID is required")
			}

		# Step 1: Find employee by app_id
		employee = frappe.db.get_value(
			"Employee",
			{"app_id": usr},
			["name", "employee_name", "user_id", "allow_ess", "device_id", "device_model",
			 "device_brand", "device_registered_on", "app_id", "require_password_reset"],
			as_dict=True
		)

		if not employee:
			return {
				"success": False,
				"message": _("Invalid App ID")
			}

		# Step 2: Check if ESS is allowed
		if not employee.allow_ess:
			return {
				"success": False,
				"message": _("Employee Self Service is not enabled for this account")
			}

		# Step 3: Verify app password
		# Get employee document to access password field
		employee_doc = frappe.get_doc("Employee", employee.name)

		# Retrieve password using get_password method (required for Password field type)
		stored_password = employee_doc.get_password("app_password")

		if not stored_password:
			return {
				"success": False,
				"message": _("App password not set. Please contact administrator")
			}

		if stored_password != app_password:
			return {
				"success": False,
				"message": _("Invalid app password")
			}

		# Step 4: Handle device binding
		# Check if device is already registered
		if not employee.device_id:
			# First login - register device information
			from frappe.utils import now_datetime
			frappe.db.set_value("Employee", employee.name, {
				"device_id": device_id,
				"device_model": device_model,
				"device_brand": device_brand,
				"device_registered_on": now_datetime()
			})
			frappe.db.commit()
		else:
			# Subsequent login - verify device information matches
			if (employee.device_id != device_id or
				employee.device_model != device_model or
				employee.device_brand != device_brand):
				return {
					"success": False,
					"message": _("Access denied. This account is registered to a different device. Please contact HR to reset device access.")
				}

		# Step 5: Login the user
		frappe.local.login_manager.login_as(employee.user_id)

		# Generate API credentials for the user
		api_key, api_secret = generate_api_credentials(employee.user_id)

		# Step 6: Return success with all data including require_password_reset flag
		return {
			"success": True,
			"message": _("Login successful"),
			"data": {
				"employee_id": employee.name,
				"employee_name": employee.employee_name,
				"user": employee.user_id,
				"api_key": api_key,
				"api_secret": api_secret,
				"device_id": device_id,
				"app_id": employee.app_id,
				"require_password_reset": employee.require_password_reset or 0
			}
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), _("Mobile App Login Error"))
		# print(f"Login error: {str(e)}")
		return {
			"success": False,
			"message": _("An error occurred during login. Please try again")
		}


def generate_api_credentials(user):
	# print("generate_api_credentials")
	"""
	Generate or retrieve API key and secret for the user

	Args:
		user: Username/Email

	Returns:
		tuple: (api_key, api_secret)
	"""
	user_doc = frappe.get_doc("User", user)
	api_key = user_doc.api_key
	# print(api_key)
	api_secret = frappe.generate_hash(length=15)
	# print(api_secret)

	if not api_key:
		api_key = frappe.generate_hash(length=15)
		user_doc.api_key = api_key

	user_doc.api_secret = api_secret
	user_doc.save(ignore_permissions=True)

	return api_key, user_doc.get_password("api_secret")


@frappe.whitelist()
def reset_app_password(new_password):
	"""
	Reset app password for authenticated user (called on first login)

	Args:
		new_password: New password to set

	Returns:
		dict: Success or error message
	"""
	try:
		user = frappe.session.user

		if user == "Guest":
			return {
				"success": False,
				"message": _("Authentication required")
			}

		# Get employee record
		employee = frappe.db.get_value(
			"Employee",
			{"user_id": user},
			["name", "require_password_reset"],
			as_dict=True
		)

		if not employee:
			return {
				"success": False,
				"message": _("Employee record not found")
			}

		# Get employee document to update password
		employee_doc = frappe.get_doc("Employee", employee.name)

		# Set new password and clear reset flag
		employee_doc.app_password = new_password
		employee_doc.require_password_reset = 0
		employee_doc.save(ignore_permissions=True)
		frappe.db.commit()

		return {
			"success": True,
			"message": _("Password reset successfully")
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), _("Reset App Password Error"))
		return {
			"success": False,
			"message": _("An error occurred. Please try again")
		}


@frappe.whitelist()
def reset_device_id(employee_id):
	"""
	Reset device ID for an employee (Admin only)

	Args:
		employee_id: Employee ID

	Returns:
		dict: Success or error message
	"""
	try:
		if not frappe.has_permission("Employee", "write"):
			return {
				"success": False,
				"message": _("Insufficient permissions")
			}

		frappe.db.set_value("Employee", employee_id, {
			"device_id": None,
			"device_model": None,
			"device_brand": None,
			"device_registered_on": None
		})
		frappe.db.commit()

		return {
			"success": True,
			"message": _("Device ID has been reset successfully. Employee can now login from a new device.")
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), _("Reset Device ID Error"))
		return {
			"success": False,
			"message": _("An error occurred. Please try again")
		}


@frappe.whitelist()
def change_app_password(old_app_password, new_app_password):
	"""
	Allow employee to change their app password

	Args:
		old_app_password: Current app password
		new_app_password: New app password

	Returns:
		dict: Success or error message
	"""
	try:
		user = frappe.session.user

		# Get employee record (without password field)
		employee = frappe.db.get_value(
			"Employee",
			{"user_id": user},
			["name"],
			as_dict=True
		)

		if not employee:
			return {
				"success": False,
				"message": _("No employee record found")
			}

		# Get employee document to access password
		employee_doc = frappe.get_doc("Employee", employee.name)

		# Verify current password using get_password method
		stored_password = employee_doc.get_password("app_password")

		if not stored_password or stored_password != old_app_password:
			return {
				"success": False,
				"message": _("Current app password is incorrect")
			}

		# Set new password and save
		employee_doc.app_password = new_app_password
		employee_doc.save(ignore_permissions=True)
		frappe.db.commit()

		return {
			"success": True,
			"message": _("App password changed successfully")
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), _("Change App Password Error"))
		return {
			"success": False,
			"message": _("An error occurred. Please try again")
		}