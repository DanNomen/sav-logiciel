import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { AiFillGithub } from "react-icons/ai";
import { useNavigate } from "react-router-dom"; // <--- Import pour navigation
import "./Login.css";

function Login() {
  // ===============================
  // États du formulaire
  // ===============================
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const navigate = useNavigate(); // <--- Hook pour redirection

  // ===============================
  // Soumission du formulaire LOGIN
  // ===============================
  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("BUTTON CLICKED");
    console.log("EMAIL:", email);
    console.log("PASSWORD:", password);
    console.log("REMEMBER ME:", rememberMe);

    try {
      const response = await fetch("http://localhost:8000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      console.log("SERVER RESPONSE:", data);

      if (data.token) {
        // Sauvegarder les infos utilisateur (dont le rôle)
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/dashboard");
      } else {
        alert("Login échoué");
      }
    } catch (error) {
      console.error("LOGIN ERROR:", error);
      alert("Erreur serveur");
    }
  };

  // ===============================
  // Boutons sociaux (Google / Github)
  // ===============================
  const handleGoogleLogin = () => {
    console.log("Google login clicked");
  };

  const handleGithubLogin = () => {
    console.log("GitHub login clicked");
  };

  return (
    <div className="login-container">
      {/* Arrière-plan animé */}
      {/* Arrière-plan géré par App.jsx */}

      {/* Carte de connexion */}
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Bienvenue</h1>
          <p className="login-subtitle">Connectez-vous</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="login-form">
          {/* Email */}
          <div className="form-group">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              required
              className="form-input"
            />
          </div>

          {/* Mot de passe */}
          <div className="form-group">
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="form-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="form-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>

            <a href="#" className="forgot-password">
              Forgot password?
            </a>
          </div>

          <button type="submit" className="submit-button">
            Sign In
          </button>
        </form>

        <div className="divider">
          <span>or continue with</span>
        </div>

        <div className="social-login">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="social-button google-button"
          >
            <FcGoogle size={20} />
            <span>Google</span>
          </button>

          <button
            type="button"
            onClick={handleGithubLogin}
            className="social-button github-button"
          >
            <AiFillGithub size={20} />
            <span>GitHub</span>
          </button>
        </div>

        <div className="signup-link">
          Don&apos;t have an account?{" "}
          <a href="#" className="signup-link-text">
            Sign up
          </a>
        </div>
      </div>
    </div>
  );
}

export default Login;
