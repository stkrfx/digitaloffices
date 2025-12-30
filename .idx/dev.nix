{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [
  ];
  env = { };
  idx = {
    extensions = [ ];
    previews = {
      enable = true;
      previews = { };
    };
    workspace = {
      onCreate = { };
      onStart = { };
    };
  };
}
