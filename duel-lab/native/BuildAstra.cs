using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.AddressableAssets.Settings;
using UnityEditor.AddressableAssets;
using UnityEngine;

public static class BuildAstra
{
    public static void Build()
    {
        string output = Environment.GetEnvironmentVariable("ASTRA_BUILD_OUTPUT");
        if (string.IsNullOrEmpty(output)) throw new InvalidOperationException("ASTRA_BUILD_OUTPUT is required");
        EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Standalone, BuildTarget.StandaloneWindows64);
        PlayerSettings.SetScriptingBackend(NamedBuildTarget.Standalone, ScriptingImplementation.Mono2x);
        PlayerSettings.productName = "MDPro3 - Astra Duel";
        PlayerSettings.runInBackground = true;
        PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
        PlayerSettings.defaultScreenWidth = 1600;
        PlayerSettings.defaultScreenHeight = 1000;
        AddressableAssetSettingsDefaultObject.Settings.BuildAddressablesWithPlayerBuild = AddressableAssetSettings.PlayerBuildOption.DoNotBuildWithPlayer;
        if (Environment.GetEnvironmentVariable("ASTRA_REUSE_BUNDLES") != "1") {
            AddressableAssetSettings.BuildPlayerContent(out var addressables);
            if (!string.IsNullOrEmpty(addressables.Error)) throw new Exception(addressables.Error);
        }
        BuildReport report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
            scenes = new [] { "Assets/Scenes/Boot.unity" },
            locationPathName = output,
            target = BuildTarget.StandaloneWindows64,
            options = BuildOptions.None
        });
        if (report.summary.result != BuildResult.Succeeded)
            throw new Exception("Astra client build failed: " + report.summary.result);
        Debug.Log("ASTRA_BUILD_SUCCESS " + output);
    }
}
